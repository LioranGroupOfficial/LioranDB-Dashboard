import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { decrypt, encrypt } from '@/lib/crypto';
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

    const users = (instance.databaseUsers || []).map((u) => {
      let password = '';
      if (u.encryptedPassword) {
        try {
          password = decrypt(u.encryptedPassword);
        } catch {}
      } else if (u.username === instance.username && instance.encryptedControlPlaneCredential) {
        try {
          password = decrypt(instance.encryptedControlPlaneCredential);
        } catch {}
      }
      return {
        username: u.username,
        role: u.role || 'readWrite',
        status: u.status || 'ACTIVE',
        password: password || undefined,
        createdAt: u.createdAt || instance.createdAt,
      };
    });

    return NextResponse.json({ success: true, users, maxUsers: 5, currentCount: users.length });
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
    const { username, role: requestedRole } = body;

    const trimmedUsername = (username || '').trim();
    if (!trimmedUsername || !/^[a-zA-Z0-9_-]{3,32}$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3-32 alphanumeric characters, dashes, or underscores.' },
        { status: 400 }
      );
    }

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

    if (instance.status === 'TERMINATED' || instance.status === 'DELETED') {
      return NextResponse.json({ error: 'Cannot add users to a terminated instance.' }, { status: 400 });
    }

    // Enforce max 5 users limit
    const currentUsers = instance.databaseUsers || [];
    if (currentUsers.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum limit of 5 database users reached for this instance. Delete an existing user before creating a new one.' },
        { status: 400 }
      );
    }

    // Check if username already exists
    if (currentUsers.some((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
      return NextResponse.json(
        { error: `Database user "${trimmedUsername}" already exists.` },
        { status: 409 }
      );
    }

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    const effectiveRole = requestedRole || 'read_write';
    const result = await client.createUser({
      username: trimmedUsername,
      role: effectiveRole,
    });

    // Store encrypted password on the database user record
    const encryptedPassword = result.generatedPassword
      ? encrypt(result.generatedPassword)
      : undefined;
    if (!instance.databaseUsers) instance.databaseUsers = [];
    instance.databaseUsers.push({
      username: trimmedUsername,
      role: result.role || 'read_write',
      status: 'ACTIVE',
      encryptedPassword,
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
      username: result.username,
      generatedPassword: result.generatedPassword,
      password: result.generatedPassword,
      message: 'Database user created successfully.',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

