import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { generateDatabasePassword } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const session = await requireUserAPI();
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

    instance.databaseUsers = (instance.databaseUsers || []).filter(
      (u) => u.username.toLowerCase() !== username.toLowerCase()
    );

    await instance.save();

    await createAuditLog({
      userId: session.userId,
      action: 'DATABASE_USER_DELETED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { username },
    });

    return NextResponse.json({ success: true, message: `User ${username} deleted successfully` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete database user';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const session = await requireUserAPI();
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

    const userExists = (instance.databaseUsers || []).some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    ) || (instance.username && instance.username.toLowerCase() === username.toLowerCase());

    if (!userExists) {
      return NextResponse.json({ error: 'User not found on this instance' }, { status: 404 });
    }

    const newPassword = generateDatabasePassword(24);

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
    const message = error instanceof Error ? error.message : 'Failed to reset database user password';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
