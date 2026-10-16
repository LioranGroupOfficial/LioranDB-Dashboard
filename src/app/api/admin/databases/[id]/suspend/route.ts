import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { provisioningProvider } from '@/lib/providers/provisioning';
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
    const reason = body.reason?.trim() || 'Administrative suspension';

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    try {
      const client = await LioranDBAdminClient.forInstanceAsync(instance);
      await client.suspend();
    } catch (clientErr) {
      console.warn(`[Admin Suspend] Rust client suspend notice for instance ${id}:`, (clientErr as Error).message);
    }

    await provisioningProvider.suspendDeployment(instance._id.toString(), reason);

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'INSTANCE_SUSPENDED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Instance '${instance.name}' suspended successfully`,
      status: 'SUSPENDED',
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Suspend] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
