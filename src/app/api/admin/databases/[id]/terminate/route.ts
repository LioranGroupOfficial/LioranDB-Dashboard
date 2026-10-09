import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, BillingInterval } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const reason = body.reason?.trim() || 'Admin permanent termination';
    const confirmation = body.confirmation?.trim();

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    if (!confirmation || confirmation !== instance.name) {
      return NextResponse.json(
        { error: `Confirmation text must match instance name '${instance.name}'` },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1. Close current billing interval
    await BillingInterval.updateMany(
      { instanceId: instance._id, stoppedAt: { $exists: false } },
      { $set: { stoppedAt: now } }
    );

    // 2. Safely reset engine to wipe customer collections/documents/users
    try {
      const client = await LioranDBAdminClient.forInstanceAsync(instance);
      await client.resetInstance({ confirmation: instance.name });
    } catch (resetErr) {
      console.warn('[API Admin Database Terminate] Engine wipe warning:', (resetErr as Error).message);
    }

    // 3. Update database instance state
    instance.status = 'TERMINATED';
    instance.terminatedAt = now;
    instance.terminationReason = reason;
    instance.billingStoppedAt = now;
    instance.databaseUsers = [];
    await instance.save();

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'INSTANCE_TERMINATED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        customerId: instance.customerId?.toString(),
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Instance '${instance.name}' has been terminated and customer access stopped.`,
      status: 'TERMINATED',
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Terminate] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terminate instance failed' },
      { status: 500 }
    );
  }
}
