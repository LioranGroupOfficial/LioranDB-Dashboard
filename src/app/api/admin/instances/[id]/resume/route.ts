import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, BillingInterval } from '@/lib/db';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status !== 'SUSPENDED') {
      return NextResponse.json({ error: 'Instance is not suspended' }, { status: 400 });
    }

    if (instance.providerDeploymentId) {
      await provisioningProvider.resumeDeployment(instance.providerDeploymentId);
    }

    const now = new Date();
    instance.status = 'ACTIVE';
    instance.suspendedAt = undefined;
    instance.suspensionReason = undefined;
    await instance.save();

    // Start a new billing interval
    await BillingInterval.create({
      instanceId: instance._id,
      customerId: instance.customerId,
      startedAt: now,
      hourlyRatePaise: instance.hourlyRatePaise,
      backupMonthlyPaise: instance.backupMonthlyPaise,
      backupEnabled: instance.backupEnabled,
      planId: instance.planId,
      planName: instance.planName,
      couponCode: instance.couponCode,
      couponDiscountPercentage: instance.couponDiscountPercentage,
    });

    await createAuditLog({
      userId: admin.userId,
      action: 'SERVICE_RESUMED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { customerId: instance.customerId.toString() },
    });

    await createNotification({
      userId: instance.customerId.toString(),
      type: 'SERVICE_RESUMED',
      title: 'Database Instance Resumed',
      body: `Your database instance "${instance.name}" has been resumed and is active.`,
      link: `/database/${instance._id}`,
    });

    return NextResponse.json({ success: true, message: 'Instance resumed successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to resume instance';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
