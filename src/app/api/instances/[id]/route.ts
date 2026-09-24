import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, Subscription } from '@/lib/db';
import { getPlan } from '@/lib/plans';
import { createAuditLog } from '@/lib/audit';

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

    inst.status = 'TERMINATED';
    await inst.save();

    if (inst.subscriptionId) {
      await Subscription.findByIdAndUpdate(inst.subscriptionId, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'User initiated termination',
      });
    }

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'DATABASE_TERMINATED',
      entityType: 'ManagedDatabase',
      entityId: inst._id.toString(),
      metadata: { name: inst.name, planId: inst.planId },
    });

    return NextResponse.json({
      success: true,
      message: `Instance "${inst.name}" has been terminated.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete instance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

