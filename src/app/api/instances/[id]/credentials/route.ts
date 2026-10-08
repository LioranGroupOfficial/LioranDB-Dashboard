import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { createApiError } from '@/lib/errors';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAccountVerifiedUserAPI();
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
        connectionUri = '';
      }
    }

    // If not decrypted or missing, generate masked fallback
    if (!connectionUri) {
      const isTls = inst.port === 443 || inst.port === 8443;
      connectionUri = buildLioranDBConnectionUri({
        username: inst.username || 'admin',
        password: '••••••••',
        host: inst.host || '127.0.0.1',
        port: inst.port || 27018,
        database: inst.databaseName || 'default',
        scheme: isTls ? 'liorandb+https' : 'liorandb',
        tls: isTls,
        transport: 'grpc',
      });
    }

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'CREDENTIALS_REVEALED',
      entityType: 'ManagedDatabase',
      entityId: inst._id.toString(),
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        connectionUri,
        host: inst.host,
        port: inst.port,
        grpcUrl: inst.grpcUrl,
        grpcPort: inst.grpcPort,
        databaseName: inst.databaseName,
        username: inst.username,
        serverVersion: inst.serverVersion,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: unknown) {
    return createApiError(error);
  }
}
