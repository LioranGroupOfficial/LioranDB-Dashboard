import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, BillingInterval } from '@/lib/db';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Administrative action';

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Instance is already suspended' }, { status: 400 });
    }

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Cannot suspend a terminated instance' }, { status: 400 });
    }

    if (instance.providerDeploymentId) {
      await provisioningProvider.suspendDeployment(instance.providerDeploymentId, reason);
    }

    const now = new Date();
    instance.status = 'SUSPENDED';
    instance.suspendedAt = now;
    instance.suspensionReason = reason;
    await instance.save();

    // Close current billing interval
    await BillingInterval.updateMany(
      { instanceId: instance._id, endedAt: { $exists: false } },
      { $set: { endedAt: now } }
    );

    await createAuditLog({
      userId: admin.userId,
      action: 'SERVICE_SUSPENDED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { reason, customerId: instance.customerId.toString() },
    });

    await createNotification({
      userId: instance.customerId.toString(),
      type: 'SERVICE_SUSPENDED',
      title: 'Database Instance Suspended',
      body: `Your database instance "${instance.name}" has been suspended: ${reason}`,
      link: `/database/${instance._id}`,
    });

    return NextResponse.json({ success: true, message: 'Instance suspended successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to suspend instance';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
