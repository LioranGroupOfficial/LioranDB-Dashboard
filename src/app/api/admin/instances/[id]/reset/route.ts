import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { generateDatabasePassword, encrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

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

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Cannot reset a terminated instance' }, { status: 400 });
    }

    const client = LioranDBAdminClient.forInstance(instance);
    const rotateRes = await client.rotateRootCredential();
    const newPassword = rotateRes.newGeneratedPassword;

    if (instance.providerDeploymentId) {
      await provisioningProvider.resetDeployment(instance.providerDeploymentId);
    }

    const isLocal =
      instance.host === 'localhost' ||
      instance.host === '127.0.0.1' ||
      instance.host === '0.0.0.0' ||
      instance.host?.startsWith('127.') ||
      instance.host === '::1';
    const sslParam = isLocal ? 'ssl=false' : 'ssl=true';

    const connectionUri = `mongodb://${instance.username}:${encodeURIComponent(
      newPassword
    )}@${instance.host}:${instance.port}/${instance.databaseName}?authSource=admin&${sslParam}`;
    instance.encryptedConnectionUri = encrypt(connectionUri);
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
      username: instance.username,
      temporaryPassword: newPassword,
      message: 'Master password has been reset. Store it securely; it will not be shown again.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset instance';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

