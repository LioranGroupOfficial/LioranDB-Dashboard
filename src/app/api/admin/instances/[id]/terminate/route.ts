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
    const reason = body.reason || 'Terminated by administrator';

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Instance is already terminated' }, { status: 400 });
    }

    if (instance.providerDeploymentId) {
      await provisioningProvider.terminateDeployment(instance.providerDeploymentId);
    }

    const now = new Date();
    instance.status = 'TERMINATED';
    instance.billingStoppedAt = now;
    instance.terminatedAt = now;
    instance.terminationReason = reason;
    await instance.save();

    // Close all open billing intervals
    await BillingInterval.updateMany(
      { instanceId: instance._id, endedAt: { $exists: false } },
      { $set: { endedAt: now } }
    );

    await createAuditLog({
      userId: admin.userId,
      action: 'SERVICE_DELETED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { reason, customerId: instance.customerId.toString() },
    });

    await createNotification({
      userId: instance.customerId.toString(),
      type: 'INSTANCE_DELETED',
      title: 'Database Instance Terminated',
      body: `Your database instance "${instance.name}" has been terminated by an administrator: ${reason}`,
      link: '/database',
    });

    return NextResponse.json({ success: true, message: 'Instance terminated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to terminate instance';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

