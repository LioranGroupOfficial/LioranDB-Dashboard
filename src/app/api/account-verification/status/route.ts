import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUserAPI, isAccountVerified } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { fetchRazorpayOrderPayments } from '@/lib/razorpay';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';
import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUserAPI();
    await connectToDatabase();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    const dbUser = await User.findById(sessionUser.userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // 1. If already verified in database
    if (isAccountVerified(dbUser)) {
      return NextResponse.json({
        verified: true,
        status: 'VERIFIED',
        message: 'Account is verified and active.',
      });
    }

    // 2. Check pending payment record and reconcile with Razorpay
    const pendingPayment = await Payment.findOne({
      userId: dbUser._id,
      type: 'account_verification',
      status: 'PENDING',
    }).sort({ createdAt: -1 });

    if (pendingPayment && pendingPayment.razorpayOrderId) {
      try {
        const orderPayments = await fetchRazorpayOrderPayments(pendingPayment.razorpayOrderId);
        const successfulPayment = orderPayments.items?.find(
          (p) => (p.status === 'captured' || p.status === 'authorized') && p.amount === 3000
        );

        if (successfulPayment) {
          const paidAt = new Date();
          await User.findByIdAndUpdate(dbUser._id, {
            $set: {
              accountVerification: {
                feePaid: true,
                amountPaid: 30,
                currency: 'INR',
                paidAt,
                razorpayOrderId: pendingPayment.razorpayOrderId,
                razorpayPaymentId: successfulPayment.id,
                verificationMethod: 'RAZORPAY',
                status: 'VERIFIED',
              },
              accountRegistrationPaid: true,
              accountRegistrationPaidAt: paidAt,
              onboardingStage: 'ACTIVE',
            },
          });

          await Payment.findByIdAndUpdate(pendingPayment._id, {
            $set: {
              status: 'PAID',
              razorpayPaymentId: successfulPayment.id,
              paidAt,
              notes: 'Reconciled via Status Check API',
            },
          });

          try {
            const session = await getSession();
            if (session && session.userId === sessionUser.userId) {
              session.accountVerified = true;
              await session.save();
            }
          } catch {
            // Non-fatal
          }

          await createAuditLog({
            userId: sessionUser.userId,
            actorId: sessionUser.userId,
            actorRole: 'customer',
            action: 'ACCOUNT_VERIFICATION_COMPLETED',
            entityType: 'User',
            entityId: sessionUser.userId,
            metadata: {
              reconciledVia: 'STATUS_CHECK_API',
              orderId: pendingPayment.razorpayOrderId,
              paymentId: successfulPayment.id,
            },
            ip,
            userAgent,
          });

          await createNotification({
            userId: sessionUser.userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Account Activated',
            body: 'Your ₹30 account verification payment was reconciled. You have full access to LioranDB Cloud.',
            link: '/dashboard',
          });

          return NextResponse.json({
            verified: true,
            status: 'VERIFIED',
            message: 'Payment found and verified! Your account is now active.',
          });
        }
      } catch (err) {
        console.error('[Status Check] Error reconciling with Razorpay:', err);
      }
    }

    return NextResponse.json({
      verified: false,
      status: dbUser.accountVerification?.status || 'UNPAID',
      message: 'Account verification payment is pending.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
