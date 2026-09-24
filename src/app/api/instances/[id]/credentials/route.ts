import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const inst = await ManagedDatabase.findById(id);

    if (!inst) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (
      sessionUser.role !== 'admin' &&
      inst.customerId.toString() !== sessionUser.userId &&
      inst.userId?.toString() !== sessionUser.userId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let connectionUri = '';
    if (inst.encryptedConnectionUri) {
      try {
        connectionUri = decrypt(inst.encryptedConnectionUri);
      } catch {
        connectionUri = `mongodb://${inst.username}:••••••••@${inst.host}:${inst.port}/${inst.databaseName}?authSource=admin&ssl=true`;
      }
    } else {
      connectionUri = `mongodb://${inst.username}:••••••••@${inst.host}:${inst.port}/${inst.databaseName}?authSource=admin&ssl=true`;
    }

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'CREDENTIALS_REVEALED',
      entityType: 'ManagedDatabase',
      entityId: inst._id.toString(),
    });

    return NextResponse.json({
      success: true,
      connectionUri,
      host: inst.host,
      port: inst.port,
      databaseName: inst.databaseName,
      username: inst.username,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve credentials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

