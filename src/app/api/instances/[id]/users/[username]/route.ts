import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import { encrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { createApiError } from '@/lib/errors';
import { adminSharedTenantAction, rotateOwnedSharedTenantCredentials } from '@/lib/services/shared-hosting.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id, username } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (instance.customerId.toString() !== session.userId && instance.userId?.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    if (instance.planId === 'free' || instance.type === 'shared') {
      return NextResponse.json({ error: 'The user on a Free Shared database cannot be deleted.' }, { status: 400 });
    }

    if (instance.username && instance.username.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot delete the master database administrator user.' }, { status: 400 });
    }

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    await client.deleteUser(username);

    // Remove user from databaseUsers array to free up slot
    if (instance.databaseUsers) {
      instance.databaseUsers = instance.databaseUsers.filter(
        (u) => u.username.toLowerCase() !== username.toLowerCase()
      );
      await instance.save();
    }

    await createAuditLog({
      userId: session.userId,
      action: 'DATABASE_USER_DELETED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { username },
    });

    return NextResponse.json({ success: true, message: `User ${username} deleted successfully` });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id, username } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (instance.customerId.toString() !== session.userId && instance.userId?.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const isMasterUser = instance.username && instance.username.toLowerCase() === username.toLowerCase();
    if (instance.planId === 'free' && !isMasterUser) {
      return NextResponse.json({ error: 'Free Shared databases allow password changes only for the tenant user.' }, { status: 400 });
    }
    let newPassword = '';
    if (isMasterUser) {
      if (instance.planId === 'free' || instance.type === 'shared') {
        const sharedTenantId = instance.sharedTenantId || instance.providerDeploymentId;
        if (!sharedTenantId) return NextResponse.json({ error: 'Shared tenant identity is missing; refusing to rotate server root credentials.' }, { status: 409 });
        const rotated = session.role === 'admin'
          ? await adminSharedTenantAction(session.userId, sharedTenantId, 'rotate')
          : await rotateOwnedSharedTenantCredentials(session.userId, sharedTenantId);
        const credentials = 'credentials' in rotated ? rotated.credentials : undefined;
        if (!credentials) return NextResponse.json({ error: 'Shared control plane did not return tenant credentials.' }, { status: 502 });
        return NextResponse.json({
          success: true,
          username: credentials.username,
          generatedPassword: credentials.password,
          password: credentials.password,
          message: 'Tenant credentials rotated without changing the shared server root credentials.',
        });
      }
      const client = await LioranDBAdminClient.forInstanceAsync(instance);
      const rot = await client.rotateRootCredential();
      newPassword = rot.newGeneratedPassword;

      // Re-generate authoritative connection string with actual new password
      const newUri = buildLioranDBConnectionUri({
        username: instance.username || 'admin',
        password: newPassword,
        host: instance.host,
        port: instance.port || 27018,
        database: instance.databaseName || 'default',
        scheme: instance.port === 443 || instance.port === 8443 ? 'liorandb+https' : 'liorandb',
        tls: instance.port === 443 || instance.port === 8443,
        transport: 'grpc',
      });

      instance.encryptedConnectionUri = encrypt(newUri);
      instance.encryptedControlPlaneCredential = encrypt(newPassword);
      instance.rootRotatedAt = new Date();
      instance.lastCredentialRotationAt = new Date();

      if (instance.databaseUsers) {
        const u = instance.databaseUsers.find((dbu) => dbu.username.toLowerCase() === username.toLowerCase());
        if (u) {
          u.encryptedPassword = encrypt(newPassword);
          u.updatedAt = new Date();
        }
      }
      await instance.save();
    } else {
      const client = await LioranDBAdminClient.forInstanceAsync(instance);
      const res = await client.resetUserPassword(username);
      newPassword = res.newGeneratedPassword;

      if (instance.databaseUsers) {
        const u = instance.databaseUsers.find((dbu) => dbu.username.toLowerCase() === username.toLowerCase());
        if (u) {
          u.encryptedPassword = encrypt(newPassword);
          u.updatedAt = new Date();
        }
        await instance.save();
      }
    }

    await createAuditLog({
      userId: session.userId,
      action: 'DATABASE_USER_PASSWORD_RESET',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { username },
    });

    return NextResponse.json({
      success: true,
      username,
      generatedPassword: newPassword,
      password: newPassword,
      message: 'Password reset successfully.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

