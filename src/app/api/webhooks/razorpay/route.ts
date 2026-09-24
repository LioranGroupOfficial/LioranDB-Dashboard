import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { connectToDatabase, Payment, User, Subscription, ManagedDatabase } from '@/lib/db';
import { provisionInstance } from '@/lib/providers/provisioning';

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

          // If this was a registration payment
          if (payment.type === 'registration') {
            await User.findByIdAndUpdate(payment.userId, {
              accountRegistrationPaid: true,
              accountRegistrationPaidAt: new Date(),
              onboardingStage: 'ACTIVE',
            });
          }

          // If this was an instance payment
          if (payment.instanceId) {
            const instance = await ManagedDatabase.findById(payment.instanceId);
            if (instance && instance.status === 'PENDING') {
              instance.status = 'PROVISIONING';
              await instance.save();
              await provisionInstance(instance);
            }
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId },
          { status: 'FAILED', notes: paymentEntity?.error_description }
        );
      }
    } else if (eventType === 'subscription.cancelled') {
      const subEntity = payload.subscription?.entity;
      if (subEntity?.id) {
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: subEntity.id },
          { status: 'CANCELLED', cancelledAt: new Date() }
        );
      }
    }

    return NextResponse.json({ status: 'ok', received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

