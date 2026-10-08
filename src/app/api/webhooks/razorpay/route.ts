import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { connectToDatabase, Payment, Invoice, User } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    await connectToDatabase();

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id || payload.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status !== 'PAID') {
          payment.status = 'PAID';
          payment.razorpayPaymentId = paymentId;
          payment.paidAt = new Date();
          payment.razorpaySignatureVerified = true;
          await payment.save();
        }

        // Handle Account Verification Payment
        const isAccountVerification =
          paymentEntity?.notes?.type === 'ACCOUNT_VERIFICATION' ||
          payment?.type === 'account_verification';

        if (isAccountVerification) {
          const userId = paymentEntity?.notes?.userId || payment?.userId?.toString();
          if (userId) {
            const user = await User.findById(userId);
            if (user && !user.accountVerification?.feePaid) {
              const paidAt = new Date();
              user.accountVerification = {
                feePaid: true,
                amountPaid: 30,
                currency: 'INR',
                paidAt,
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                verificationMethod: 'RAZORPAY',
                status: 'VERIFIED',
              };
              user.accountRegistrationPaid = true;
              user.accountRegistrationPaidAt = paidAt;
              user.onboardingStage = 'ACTIVE';
              await user.save();

              await createAuditLog({
                userId,
                actorId: userId,
                actorRole: 'system',
                action: 'ACCOUNT_VERIFICATION_WEBHOOK_RECEIVED',
                entityType: 'User',
                entityId: userId,
                metadata: { orderId, paymentId, event: eventType },
              });

              await createAuditLog({
                userId,
                actorId: userId,
                actorRole: 'system',
                action: 'ACCOUNT_VERIFICATION_PAYMENT_SUCCEEDED',
                entityType: 'Payment',
                entityId: orderId,
                metadata: { orderId, paymentId, amountPaise: 3000 },
              });

              await createAuditLog({
                userId,
                actorId: userId,
                actorRole: 'system',
                action: 'ACCOUNT_VERIFICATION_COMPLETED',
                entityType: 'User',
                entityId: userId,
                metadata: { orderId, paymentId, via: 'WEBHOOK' },
              });
            }
          }
        }

        // Handle invoice payment
        const invoiceId = paymentEntity?.notes?.invoiceId;
        if (invoiceId) {
          const invoice = await Invoice.findById(invoiceId);
          if (invoice && invoice.status !== 'PAID') {
            invoice.status = 'PAID';
            invoice.paidAt = new Date();
            invoice.paymentTransactionReference = paymentId;
            await invoice.save();

            await createAuditLog({
              userId: invoice.customerId.toString(),
              action: 'INVOICE_PAID_WEBHOOK',
              entityType: 'INVOICE',
              entityId: invoice._id.toString(),
              metadata: { orderId, paymentId, amountPaise: invoice.totalPaise },
            });
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId },
          { status: 'FAILED', notes: paymentEntity?.error_description }
        );

        if (payment?.type === 'account_verification' || paymentEntity?.notes?.type === 'ACCOUNT_VERIFICATION') {
          const userId = paymentEntity?.notes?.userId || payment?.userId?.toString();
          if (userId) {
            await createAuditLog({
              userId,
              actorId: userId,
              actorRole: 'system',
              action: 'ACCOUNT_VERIFICATION_PAYMENT_FAILED',
              entityType: 'Payment',
              entityId: orderId,
              metadata: { orderId, error: paymentEntity?.error_description },
            });
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok', received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
