import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { createApiError } from '@/lib/errors';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id, username } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (instance.customerId.toString() !== session.userId && instance.userId?.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    if (instance.username && instance.username.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot delete the master database administrator user.' }, { status: 400 });
    }

    const client = LioranDBAdminClient.forInstance(instance);
    await client.deleteUser(username);

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

    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (instance.customerId.toString() !== session.userId && instance.userId?.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const isMasterUser = instance.username && instance.username.toLowerCase() === username.toLowerCase();
    const client = LioranDBAdminClient.forInstance(instance);

    let newPassword = '';
    if (isMasterUser) {
      const rot = await client.rotateRootCredential();
      newPassword = rot.newGeneratedPassword;
    } else {
      const res = await client.resetUserPassword(username);
      newPassword = res.newGeneratedPassword;
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
      message: 'Password reset successfully. Copy this new password now; it will not be displayed again.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

