import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { createAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id).populate('hostingNodeId');
    if (!instance) {
      return NextResponse.json({ error: 'Database instance not found' }, { status: 404 });
    }

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    const result = await client.restartInstance();

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'INSTANCE_RESTARTED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: {
        instanceId: id,
        instanceName: instance.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    const is404 = (err as any)?.statusCode === 404 || (err as any)?.name === 'LioranDBNotFoundError' || errMsg.includes('404') || errMsg.includes('not found');
    if (is404) {
      return NextResponse.json(
        {
          error: 'Database engine in-process restart is not supported via the HTTP control plane (/v1/admin/instance/restart returns 404). Container process restarts must be managed via infrastructure orchestration.',
        },
        { status: 501 }
      );
    }
    console.error('[API Admin Database Restart] Error:', err);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
