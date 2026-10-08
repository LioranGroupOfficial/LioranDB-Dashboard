import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, BillingInterval } from '@/lib/db';
import { PLANS, formatPaiseToInr } from '@/lib/plans';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';
import { provisioningProvider } from '@/lib/providers/provisioning';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findOne({
      _id: id,
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
    }).lean();

    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found.' }, { status: 404 });
    }

    const plan = PLANS[instance.planId] || { name: instance.planId, hourlyRatePaise: instance.hourlyRatePaise || 100 };
    const period = getCurrentMonthPeriod();
    const calc = calculateInstanceUsage(instance as unknown as IManagedDatabase, period);

    // Filter databaseUsers so no plaintext is exposed
    const safeUsers = (instance.databaseUsers || []).map((u: { username: string; createdAt?: Date }) => ({
      username: u.username,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({
      instance: {
        id: instance._id.toString(),
        name: instance.name,
        planId: instance.planId,
        planName: plan.name,
        hourlyRatePaise: instance.hourlyRatePaise || plan.hourlyRatePaise || 100,
        hourlyRateFormatted: formatPaiseToInr(instance.hourlyRatePaise || plan.hourlyRatePaise || 100) + '/hr',
        status: instance.status,
        host: instance.host,
        port: instance.port,
        databaseName: instance.databaseName,
        username: instance.username,
        backupEnabled: Boolean(instance.backupEnabled),
        billingStartedAt: instance.billingStartedAt ? new Date(instance.billingStartedAt).toISOString() : null,
        currentEstimatedUsagePaise: calc.totalPaise,
        currentEstimatedHours: calc.billableHours,
        couponCode: instance.couponCode,
        couponDiscountPercentage: instance.couponDiscountPercentage,
        databaseUsers: safeUsers,
        createdAt: instance.createdAt ? new Date(instance.createdAt).toISOString() : new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findOne({
      _id: id,
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
    });

    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found.' }, { status: 404 });
    }

    if (instance.status === 'TERMINATED') {
      return NextResponse.json({ error: 'This instance is already terminated.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { confirmName, reason } = body as { confirmName?: string; reason?: string };

    if (confirmName !== instance.name) {
      return NextResponse.json(
        { error: `Confirmation name does not match. Please enter "${instance.name}" to confirm termination.` },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1. Invoke termination and real server reset on assigned node
    await provisioningProvider.terminateDeployment(instance._id.toString());

    // 2. Mark instance terminated and record billingStoppedAt
    instance.status = 'TERMINATED';
    instance.billingStoppedAt = now;
    if (instance.backupEnabled) {
      instance.backupStoppedAt = now;
    }
    await instance.save();

    // 3. Close active billing interval
    await BillingInterval.findOneAndUpdate(
      { instanceId: instance._id, endedAt: null },
      { endedAt: now }
    );

    // 3. Audit log
    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'DATABASE_TERMINATED',
      entityType: 'ManagedDatabase',
      entityId: instance._id.toString(),
      metadata: {
        instanceName: instance.name,
        planId: instance.planId,
        reason: reason || 'Customer requested termination',
        billingStoppedAt: now,
      },
    });

    await createNotification({
      userId: sessionUser.userId,
      type: 'SERVICE_DELETED',
      title: 'Database Instance Terminated',
      body: `Your database instance "${instance.name}" has been terminated and its billing has been halted. Any accumulated usage will be included on your monthly invoice.`,
      link: '/database',
    });

    return NextResponse.json({
      success: true,
      message: `Database instance "${instance.name}" has been terminated. Usage billing stopped.`,
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

