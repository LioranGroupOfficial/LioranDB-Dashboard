import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, username } = await params;

    const isLimited = await rateLimit(`admin:db:users:reset:${admin.userId}`, 15, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many password reset requests. Please wait a moment.' }, { status: 429 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const decodedUsername = decodeURIComponent(username);
    const client = LioranDBAdminClient.forInstance(instance);
    const result = await client.resetUserPassword(decodedUsername);

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'DATABASE_USER_PASSWORD_RESET',
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
      username: result.username,
      newGeneratedPassword: result.newGeneratedPassword,
      rotatedAt: result.rotatedAt,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database User Password Reset] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
