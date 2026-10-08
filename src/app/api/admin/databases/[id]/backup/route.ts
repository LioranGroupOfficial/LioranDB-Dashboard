import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const isLimited = await rateLimit(`admin:db:backup:${admin.userId}`, 5, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many backup requests. Please wait a minute.' }, { status: 429 });
    }

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const client = LioranDBAdminClient.forInstance(instance);
    const result = await client.triggerBackup();

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'BACKUP_TRIGGERED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
        backupId: result.backupId,
        sizeBytes: result.sizeBytes,
      },
    });

    return NextResponse.json({
      success: true,
      backup: result,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Database Backup] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
