import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { generateDatabasePassword } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { createApiError } from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findById(id).lean();
    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (instance.customerId.toString() !== session.userId && instance.userId?.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const users = (instance.databaseUsers || []).map((u: { username: string; createdAt?: Date }) => ({
      username: u.username,
      createdAt: u.createdAt || instance.createdAt,
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    const body = await req.json();
    const { username } = body;

    const trimmedUsername = (username || '').trim();
    if (!trimmedUsername || !/^[a-zA-Z0-9_-]{3,32}$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3-32 alphanumeric characters, dashes, or underscores.' },
        { status: 400 }
      );
    }

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

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Cannot add users to a terminated instance.' }, { status: 400 });
    }

    const existingUsers = instance.databaseUsers || [];
    if (existingUsers.some((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
      return NextResponse.json({ error: 'A user with this username already exists on this instance.' }, { status: 400 });
    }

    const temporaryPassword = generateDatabasePassword(24);

    instance.databaseUsers.push({
      username: trimmedUsername,
      createdAt: new Date(),
    });

    await instance.save();

    await createAuditLog({
      userId: session.userId,
      action: 'DATABASE_USER_CREATED',
      entityType: 'INSTANCE',
      entityId: instance._id.toString(),
      metadata: { username: trimmedUsername },
    });

    return NextResponse.json({
      success: true,
      username: trimmedUsername,
      generatedPassword: temporaryPassword,
      password: temporaryPassword,
      message: 'Database user created. Copy this password now; it will not be displayed again.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

