import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { adminSharedTenantAction, getManagedSharedTenantId } from '@/lib/services/shared-hosting.service';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const isLimited = await rateLimit(`admin:db:rotate-root:${admin.userId}`, 10, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const hostingNode = instance.hostingNodeId as any;
    if (instance.type === 'shared' || instance.planId === 'free' || hostingNode?.allocationMode === 'SHARED') {
      const sharedTenantId = getManagedSharedTenantId(instance);
      if (!sharedTenantId || hostingNode?.allocationMode !== 'SHARED') {
        return NextResponse.json({ error: 'Shared allocation mapping is incomplete; refusing to rotate server root credentials.' }, { status: 409 });
      }
      const result = await adminSharedTenantAction(admin.userId, sharedTenantId, 'rotate');
      return NextResponse.json({ success: true, result, message: 'Only the shared tenant credentials were rotated.' });
    }

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    const result = await client.rotateRootCredential();

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'ROOT_CREDENTIAL_ROTATED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        rootUsername: result.rootUsername,
      },
    });

    return NextResponse.json({
      success: true,
      rootUsername: result.rootUsername,
      newGeneratedPassword: result.newGeneratedPassword,
      rotatedAt: result.rotatedAt,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Rotate Root] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
