import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Payment, Subscription } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { provisionInstance } from '@/lib/providers/provisioning';
import { getPlan, calculatePlanPrice } from '@/lib/plans';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();
    const { instanceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!instanceId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required payment verification details.' },
        { status: 400 }
      );
    }

    // Server-side HMAC verification
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

    const instance = await ManagedDatabase.findById(instanceId);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found.' }, { status: 404 });
    }

    // Verify ownership
    if (
      instance.customerId.toString() !== user._id.toString() &&
      instance.userId?.toString() !== user._id.toString()
    ) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    // Idempotency: If instance is already active/provisioned
    if (instance.status === 'ACTIVE' || instance.status === 'RUNNING') {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        instanceId: instance._id.toString(),
        status: instance.status,
      });
    }

    const plan = getPlan(instance.planId);
    const price = calculatePlanPrice(instance.planId, !!instance.backupEnabled);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. Update Payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        userId: user._id,
        instanceId: instance._id,
        amount: price.totalPriceRupees,
        amountPaise: price.totalPricePaise,
        currency: 'INR',
        status: 'PAID',
        type: 'instance_subscription',
        planId: instance.planId,
        backupAddon: price.backupAddon,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        razorpaySignatureVerified: true,
        paidAt: now,
        notes: `Paid for ${instance.name} (${plan?.name})`,
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Create or Update Subscription
    const subscription = await Subscription.create({
      userId: user._id,
      databaseId: instance._id,
      instanceId: instance._id,
      planId: instance.planId,
      planName: plan?.name || 'Starter Dedicated',
      amount: price.totalPriceRupees,
      basePricePaise: price.basePricePaise,
      backupAddon: price.backupAddon,
      backupPricePaise: price.backupPricePaise,
      totalPricePaise: price.totalPricePaise,
      currency: 'INR',
      status: 'ACTIVE',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextPaymentDate: periodEnd,
    });

    instance.subscriptionId = subscription._id;
    instance.status = 'PROVISIONING';
    await instance.save();

    if (payment) {
      payment.subscriptionId = subscription._id;
      await payment.save();
    }

    // 3. Trigger provisioning service
    const provisionedInstance = await provisionInstance(instance, user.email);

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'DATABASE_PROVISIONED',
      entityType: 'ManagedDatabase',
      entityId: instance._id.toString(),
      metadata: {
        planId: instance.planId,
        name: instance.name,
        backupAddon: price.backupAddon,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    await createNotification({
      userId: user._id.toString(),
      type: 'PROVISIONING_COMPLETE',
      title: 'Database Instance Ready',
      body: `Your instance "${instance.name}" (${plan?.name}) has been provisioned and is now active.`,
      link: `/database/${instance._id}`,
    });

    return NextResponse.json({
      success: true,
      instanceId: provisionedInstance._id.toString(),
      status: provisionedInstance.status,
      host: provisionedInstance.host,
      port: provisionedInstance.port,
      databaseName: provisionedInstance.databaseName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    console.error('[Instance Verify Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
