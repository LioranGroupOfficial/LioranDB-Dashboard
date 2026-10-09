import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, username } = await params;

    const isLimited = await rateLimit(`admin:db:users:del:${admin.userId}`, 20, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const decodedUsername = decodeURIComponent(username);
    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    await client.deleteUser(decodedUsername);

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'DATABASE_USER_DELETED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        targetUsername: decodedUsername,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User '${decodedUsername}' deleted successfully`,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database User Delete] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, username } = await params;

    const isLimited = await rateLimit(`admin:db:users:patch:${admin.userId}`, 20, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body.status?.toUpperCase();

    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      return NextResponse.json({ error: 'Invalid status. Expected ACTIVE or DISABLED' }, { status: 400 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const decodedUsername = decodeURIComponent(username);
    const client = await LioranDBAdminClient.forInstanceAsync(instance);

    if (status === 'DISABLED') {
      await client.disableUser(decodedUsername);
    } else {
      await client.enableUser(decodedUsername);
    }

    const action = status === 'DISABLED' ? 'DATABASE_USER_DISABLED' : 'DATABASE_USER_ENABLED';

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action,
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        targetUsername: decodedUsername,
        newStatus: status,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User '${decodedUsername}' status changed to ${status}`,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database User Patch] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
