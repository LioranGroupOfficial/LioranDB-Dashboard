import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import { encrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Cannot reset a terminated instance' }, { status: 400 });
    }

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    const rotateRes = await client.rotateRootCredential();
    const newPassword = rotateRes.newGeneratedPassword;

    const isTls = instance.port === 443 || instance.port === 8443;
    const connectionUri = buildLioranDBConnectionUri({
      username: instance.username || rotateRes.rootUsername || 'admin',
      password: newPassword,
      host: instance.host,
      port: instance.port || 27018,
      database: instance.databaseName || 'default',
      scheme: isTls ? 'liorandb+https' : 'liorandb',
      tls: isTls,
      transport: 'grpc',
    });

    instance.encryptedConnectionUri = encrypt(connectionUri);
    instance.lastCredentialRotationAt = new Date();
    instance.rootRotatedAt = new Date();
    await instance.save();

    await createAuditLog({
      userId: admin.userId,
      action: 'CREDENTIALS_REVEALED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { action: 'ADMIN_PASSWORD_RESET', customerId: instance.customerId.toString() },
    });

    return NextResponse.json({
      success: true,
      username: instance.username || rotateRes.rootUsername,
      temporaryPassword: newPassword,
      message: 'Master password has been reset. Store it securely; it will not be shown again.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset instance';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
