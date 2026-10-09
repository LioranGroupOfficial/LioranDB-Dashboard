import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import { encrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let adminUserId = '';

  try {
    const admin = await requireAdmin();
    adminUserId = admin.userId;

    const isLimited = await rateLimit(`admin:db:reset:${admin.userId}`, 3, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many reset requests. Please wait a minute.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = body.confirmation?.trim();
    const idempotencyKey = req.headers.get('x-idempotency-key') || body.idempotencyKey;

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

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'INSTANCE_RESET_STARTED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        idempotencyKey,
      },
    });

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    const serverStatus = await client.getServerStatus();
    const targetInstanceId = serverStatus.instanceId || `node-1`;

    const result = await client.resetInstance({
      instanceId: targetInstanceId,
      idempotencyKey,
    });

    // Re-key native connection URI with fresh bootstrap credentials
    const isTls = instance.port === 443 || instance.port === 8443;
    const newUri = buildLioranDBConnectionUri({
      username: result.rootUsername,
      password: result.newGeneratedRootPassword,
      host: instance.host,
      port: instance.port || 27018,
      database: instance.databaseName || 'default',
      scheme: isTls ? 'liorandb+https' : 'liorandb',
      tls: isTls,
      transport: 'grpc',
    });

    instance.encryptedConnectionUri = encrypt(newUri);
    instance.status = 'ACTIVE';
    instance.databaseUsers = [];
    instance.rootRotatedAt = new Date();
    instance.lastCredentialRotationAt = new Date();
    await instance.save();

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'INSTANCE_RESET_COMPLETED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        rootUsername: result.rootUsername,
        resetCompletedAt: result.resetCompletedAt,
      },
    });

    return NextResponse.json({
      success: true,
      instanceId: result.instanceId,
      rootUsername: result.rootUsername,
      newGeneratedRootPassword: result.newGeneratedRootPassword,
      resetCompletedAt: result.resetCompletedAt,
      message: result.message,
    });
  } catch (err: unknown) {
    await createAuditLog({
      actorId: adminUserId || undefined,
      actorRole: 'admin',
      action: 'INSTANCE_RESET_FAILED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        error: err instanceof Error ? err.message : String(err),
      },
    });

    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Reset] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reset instance failed' },
      { status: 500 }
    );
  }
}
