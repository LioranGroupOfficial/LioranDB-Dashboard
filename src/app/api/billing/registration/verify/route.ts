import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { getSession } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { REGISTRATION_FEE_PAISE, REGISTRATION_FEE_RUPEES } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required payment verification details.' },
        { status: 400 }
      );
    }

    // Server-side HMAC SHA256 signature verification
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Idempotency: If already marked as paid, return success without duplicate writes
    if (user.accountRegistrationPaid) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: 'Account registration fee verified.',
      });
    }

    const now = new Date();

    // Find and update or upsert payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        userId: user._id,
        amount: REGISTRATION_FEE_RUPEES,
        amountPaise: REGISTRATION_FEE_PAISE,
        currency: 'INR',
        status: 'PAID',
        type: 'registration',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        razorpaySignatureVerified: true,
        paidAt: now,
        notes: 'LioranDB Account Registration Fee (₹100) - Verified',
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Update user record
    user.accountRegistrationPaid = true;
    user.accountRegistrationPaidAt = now;
    user.onboardingStage = 'ACTIVE';
    await user.save();

    // Update session
    const session = await getSession();
    session.accountRegistrationPaid = true;
    await session.save();

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'REGISTRATION_FEE_PAID',
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amountPaise: REGISTRATION_FEE_PAISE,
      },
    });

    await createNotification({
      userId: user._id.toString(),
      type: 'PAYMENT_RECEIVED',
      title: 'Registration Complete',
      body: 'Your ₹100 registration fee has been verified. You can now create and manage database instances.',
      link: '/database/create',
    });

    return NextResponse.json({
      success: true,
      message: 'Registration fee verified successfully. Your account is now active.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    console.error('[Registration Verify Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

