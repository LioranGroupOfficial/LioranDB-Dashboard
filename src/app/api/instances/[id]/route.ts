import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, Subscription } from '@/lib/db';
import { calculatePlanPrice, getPlan } from '@/lib/plans';
import { createAuditLog } from '@/lib/audit';
import { calculateInstanceDeletionRefund } from '@/lib/billing';
import { refundWallet } from '@/lib/wallet';
import { createNotification } from '@/lib/notifications';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const inst = await ManagedDatabase.findById(id);

    if (!inst) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (
      sessionUser.role !== 'admin' &&
      sessionUser.role !== 'support' &&
      inst.customerId.toString() !== sessionUser.userId &&
      inst.userId?.toString() !== sessionUser.userId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const plan = getPlan(inst.planId);
    const subscription = inst.subscriptionId
      ? await Subscription.findById(inst.subscriptionId).lean()
      : null;

    return NextResponse.json({
      instance: {
        id: inst._id.toString(),
        name: inst.name,
        slug: inst.slug,
        type: inst.type || plan?.type || 'dedicated',
        status: inst.status,
        planId: inst.planId,
        planName: plan?.name || 'Starter Dedicated',
        region: inst.region || 'ap-south-1 (Mumbai)',
        cpu: inst.cpu || plan?.cpu || '1 vCPU',
        memoryMb: inst.memoryMb || plan?.memoryMb || 1024,
        documentLimit: inst.documentLimit || plan?.documentLimit || 100000,
        backupEnabled: inst.backupEnabled ?? false,
        host: inst.host,
        port: inst.port,
        databaseName: inst.databaseName,
        username: inst.username,
        monthlyPricePaise: inst.monthlyPricePaise || (plan?.pricePaise || 149900),
        provisionedAt: inst.provisionedAt,
        createdAt: inst.createdAt,
        subscription: subscription
          ? {
              id: subscription._id.toString(),
              status: subscription.status,
              amount: subscription.amount,
              currentPeriodEnd: subscription.currentPeriodEnd,
              backupAddon: subscription.backupAddon,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch instance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const inst = await ManagedDatabase.findById(id);

    if (!inst) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (
      sessionUser.role !== 'admin' &&
      inst.customerId.toString() !== sessionUser.userId &&
      inst.userId?.toString() !== sessionUser.userId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (inst.status === 'TERMINATED' || inst.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Instance has already been terminated.' },
        { status: 400 }
      );
    }

    // 1. Calculate deletion refund according to policy:
    // < 15 mins -> 100% refund
    // < 1 hour  -> 90% refund
    // 1 to 3 hours -> 60% refund
    // > 3 hours -> 0% refund (no refund)
    const baseAmountPaise =
      inst.monthlyPricePaise ||
      calculatePlanPrice(inst.planId, !!inst.backupEnabled).totalPricePaise;

    const refundQuote = calculateInstanceDeletionRefund(
      inst.createdAt || new Date(),
      baseAmountPaise,
      new Date()
    );

    // 2. Mark instance as TERMINATED
    inst.status = 'TERMINATED';
    await inst.save();

    // 3. Cancel associated subscription
    if (inst.subscriptionId) {
      const cancelReason =
        refundQuote.refundPercentage > 0
          ? `User terminated instance (${refundQuote.refundPercentage}% refund: ₹${refundQuote.refundAmountRupees.toFixed(2)})`
          : 'User terminated instance (No refund: deleted after 3 hours)';

      await Subscription.findByIdAndUpdate(inst.subscriptionId, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: cancelReason,
      });
    }

    // 4. Process wallet refund
    const targetUserId = inst.userId || inst.customerId;
    let walletResult = null;
    if (refundQuote.refundAmountPaise > 0) {
      walletResult = await refundWallet({
        userId: targetUserId,
        amountPaise: refundQuote.refundAmountPaise,
        description: `Refund (${refundQuote.refundPercentage}%): Terminated "${inst.name}" (${refundQuote.tierLabel})`,
        instanceId: inst._id,
        idempotencyKey: `refund_del_${inst._id}`,
        metadata: {
          instanceId: inst._id.toString(),
          instanceName: inst.name,
          planId: inst.planId,
          elapsedMinutes: Math.round(refundQuote.elapsedMinutes * 10) / 10,
          refundPercentage: refundQuote.refundPercentage,
          baseAmountPaise: refundQuote.baseAmountPaise,
          refundAmountPaise: refundQuote.refundAmountPaise,
          refundAmountRupees: refundQuote.refundAmountRupees,
        },
      });
    }

    // 5. Record Audit Log
    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'DATABASE_TERMINATED',
      entityType: 'ManagedDatabase',
      entityId: inst._id.toString(),
      metadata: {
        name: inst.name,
        planId: inst.planId,
        elapsedMinutes: Math.round(refundQuote.elapsedMinutes * 10) / 10,
        refundPercentage: refundQuote.refundPercentage,
        refundAmountPaise: refundQuote.refundAmountPaise,
        refundAmountRupees: refundQuote.refundAmountRupees,
      },
    });

    // 6. Send User Notification
    const notifTitle =
      refundQuote.refundPercentage > 0
        ? 'Database Terminated & Refund Credited'
        : 'Database Instance Terminated';
    const notifBody =
      refundQuote.refundPercentage > 0
        ? `Instance "${inst.name}" has been terminated. A ${refundQuote.refundPercentage}% refund of ₹${refundQuote.refundAmountRupees.toFixed(2)} has been credited to your wallet balance.`
        : `Instance "${inst.name}" has been terminated. As deletion occurred after 3 hours of creation, no refund was applicable per policy.`;

    await createNotification({
      userId: targetUserId.toString(),
      type: 'GENERAL',
      title: notifTitle,
      body: notifBody,
      link: '/billing',
    });

    const responseMessage =
      refundQuote.refundPercentage > 0
        ? `Instance "${inst.name}" has been terminated. A ${refundQuote.refundPercentage}% refund of ₹${refundQuote.refundAmountRupees.toFixed(2)} has been credited to your wallet balance.`
        : `Instance "${inst.name}" has been terminated. No refund is eligible as deletion occurred after 3 hours of creation.`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      refund: {
        elapsedMinutes: Math.round(refundQuote.elapsedMinutes * 10) / 10,
        refundPercentage: refundQuote.refundPercentage,
        baseAmountPaise: refundQuote.baseAmountPaise,
        baseAmountRupees: refundQuote.baseAmountPaise / 100,
        refundAmountPaise: refundQuote.refundAmountPaise,
        refundAmountRupees: refundQuote.refundAmountRupees,
        tierLabel: refundQuote.tierLabel,
        newWalletBalanceRupees: walletResult ? walletResult.wallet.balancePaise / 100 : undefined,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete instance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

