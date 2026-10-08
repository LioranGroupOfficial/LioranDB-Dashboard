import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { verifyRazorpaySignature, fetchRazorpayPayment } from '@/lib/razorpay';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';
import { getSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUserAPI();
    await connectToDatabase();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    const body = await req.json();
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body || {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'Missing required payment verification parameters.' },
        { status: 400 }
      );
    }

    // 1. Verify HMAC SHA-256 signature
    const isSignatureValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isSignatureValid) {
      await createAuditLog({
        userId: sessionUser.userId,
        actorId: sessionUser.userId,
        actorRole: 'customer',
        action: 'ACCOUNT_VERIFICATION_PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: razorpayOrderId,
        metadata: { razorpayOrderId, razorpayPaymentId, reason: 'INVALID_SIGNATURE' },
        ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'Payment signature verification failed.' },
        { status: 400 }
      );
    }

    // 2. Verify payment details against Razorpay API
    let razorpayPayment;
    try {
      razorpayPayment = await fetchRazorpayPayment(razorpayPaymentId);
    } catch (fetchErr) {
      console.error('[Razorpay Verify] Could not fetch payment:', fetchErr);
      return NextResponse.json(
        { error: 'Unable to verify payment with Razorpay. Please try checking status in a moment.' },
        { status: 502 }
      );
    }

    if (!razorpayPayment) {
      return NextResponse.json(
        { error: 'Payment record not found on Razorpay.' },
        { status: 404 }
      );
    }

    if (razorpayPayment.order_id && razorpayPayment.order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: 'Payment order mismatch.' },
        { status: 400 }
      );
    }

    if (razorpayPayment.amount !== 3000 || razorpayPayment.currency !== 'INR') {
      return NextResponse.json(
        { error: 'Payment amount or currency mismatch.' },
        { status: 400 }
      );
    }

    const isCaptured = razorpayPayment.status === 'captured' || razorpayPayment.status === 'authorized';
    if (!isCaptured) {
      return NextResponse.json(
        { error: `Payment is not in captured status (current status: ${razorpayPayment.status}).` },
        { status: 400 }
      );
    }

    // 3. Atomically activate user account
    const paidAt = new Date();
    const updatedUser = await User.findOneAndUpdate(
      { _id: sessionUser.userId },
      {
        $set: {
          accountVerification: {
            feePaid: true,
            amountPaid: 30,
            currency: 'INR',
            paidAt,
            razorpayOrderId,
            razorpayPaymentId,
            verificationMethod: 'RAZORPAY',
            status: 'VERIFIED',
          },
          accountRegistrationPaid: true,
          accountRegistrationPaidAt: paidAt,
          onboardingStage: 'ACTIVE',
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'User account could not be updated.' }, { status: 404 });
    }

    // 4. Update or upsert Payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        $set: {
          userId: sessionUser.userId,
          amount: 30,
          amountPaise: 3000,
          currency: 'INR',
          status: 'PAID',
          type: 'account_verification',
          razorpayPaymentId,
          razorpaySignature,
          razorpaySignatureVerified: true,
          paidAt,
          notes: 'One-time ₹30 mandatory account verification payment (Verified)',
        },
      },
      { upsert: true }
    );

    // 5. Update session
    try {
      const session = await getSession();
      if (session && session.userId === sessionUser.userId) {
        session.accountVerified = true;
        await session.save();
      }
    } catch {
      // Session save error is non-fatal; DB is authoritative
    }

    // 6. Audit logs & notification
    await createAuditLog({
      userId: sessionUser.userId,
      actorId: sessionUser.userId,
      actorRole: 'customer',
      action: 'ACCOUNT_VERIFICATION_PAYMENT_SUCCEEDED',
      entityType: 'Payment',
      entityId: razorpayOrderId,
      metadata: {
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 3000,
        currency: 'INR',
      },
      ip,
      userAgent,
    });

    await createAuditLog({
      userId: sessionUser.userId,
      actorId: sessionUser.userId,
      actorRole: 'customer',
      action: 'ACCOUNT_VERIFICATION_COMPLETED',
      entityType: 'User',
      entityId: sessionUser.userId,
      metadata: {
        paidAt,
        razorpayOrderId,
        razorpayPaymentId,
      },
      ip,
      userAgent,
    });

    await createNotification({
      userId: sessionUser.userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Account Activated',
      body: 'Your ₹30 account verification payment was received. You have full access to LioranDB Cloud.',
      link: '/dashboard',
    });

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Account verified successfully.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
