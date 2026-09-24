import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { creditWallet } from '@/lib/wallet';
import { getSession } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { formatPaiseToRupees } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required payment verification parameters.' },
        { status: 400 }
      );
    }

    // 1. Server-side HMAC SHA256 Signature Verification
    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // 2. Find pending payment record to retrieve exact amountPaise
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    const amountPaise = payment?.amountPaise || (payment ? payment.amount * 100 : 10000);

    const idempotencyKey = `topup_rzp_${razorpay_payment_id}`;

    // 3. Atomically credit wallet and create append-only ledger transaction
    const { wallet, transaction, alreadyProcessed } = await creditWallet({
      userId: user._id,
      amountPaise,
      category: 'topup',
      description: `Added LioranDB Credits via Razorpay (${formatPaiseToRupees(amountPaise)})`,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      idempotencyKey,
      metadata: {
        paymentRecordId: payment?._id?.toString(),
      },
    });

    // 4. Update payment record
    if (payment && payment.status !== 'PAID') {
      payment.status = 'PAID';
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.razorpaySignatureVerified = true;
      payment.paidAt = new Date();
      await payment.save();
    }

    // 5. Activate user account if this was their initial topup
    if (!user.accountRegistrationPaid) {
      user.accountRegistrationPaid = true;
      user.accountRegistrationPaidAt = new Date();
      user.onboardingStage = 'ACTIVE';
      await user.save();

      const session = await getSession();
      session.accountRegistrationPaid = true;
      await session.save();
    }

    if (!alreadyProcessed) {
      await createAuditLog({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'REGISTRATION_FEE_PAID', // keep audit action compatibility
        entityType: 'Wallet',
        entityId: wallet._id.toString(),
        metadata: {
          amountPaise,
          razorpayPaymentId: razorpay_payment_id,
          newBalancePaise: wallet.balancePaise,
        },
      });

      await createNotification({
        userId: user._id.toString(),
        type: 'PAYMENT_RECEIVED',
        title: 'Credits Added',
        body: `Successfully added ${formatPaiseToRupees(
          amountPaise
        )} to your LioranDB Credit balance. Current balance: ${formatPaiseToRupees(
          wallet.balancePaise
        )}.`,
        link: '/billing',
      });
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: !!alreadyProcessed,
      balancePaise: wallet.balancePaise,
      balanceRupees: wallet.balancePaise / 100,
      creditedPaise: amountPaise,
      transactionId: transaction._id.toString(),
      message: 'Credits added successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Top-up verification failed';
    console.error('[Topup Verify Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

