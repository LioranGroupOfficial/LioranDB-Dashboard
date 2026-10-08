import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const isLimited = await rateLimit(`admin:db:users:get:${admin.userId}`, 60, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const client = LioranDBAdminClient.forInstance(instance);
    const users = await client.listUsers();

    return NextResponse.json({ success: true, users });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Users List] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const isLimited = await rateLimit(`admin:db:users:create:${admin.userId}`, 20, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const username = body.username?.trim();
    const role = body.role?.trim() || 'readWrite';

    if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-32 alphanumeric characters (_ . - allowed)' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const client = LioranDBAdminClient.forInstance(instance);
    const result = await client.createUser({ username, role });

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'DATABASE_USER_CREATED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        targetUsername: username,
        role,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        username: result.username,
        role: result.role,
        status: result.status,
        createdAt: result.createdAt,
        generatedPassword: result.generatedPassword,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[API Admin Database User Create] Error:', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
