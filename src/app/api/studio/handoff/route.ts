import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ManagedDatabase, StudioHandoff } from '@/lib/db';
import { decrypt, sha256 } from '@/lib/crypto';
import { buildLioranDBConnectionUri, parseLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import { getOwnedSharedTenant } from '@/lib/services/shared-hosting.service';
import { getSharedTenantLogicalDatabaseName } from '@/lib/liorandb-admin/shared-hosting';

const STUDIO_ORIGIN = 'https://studio.liorandb.com';

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  return {
    ...(origin === STUDIO_ORIGIN ? { 'Access-Control-Allow-Origin': STUDIO_ORIGIN } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== STUDIO_ORIGIN) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const origin = request.headers.get('origin');
  if (origin && origin !== STUDIO_ORIGIN) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403, headers });
  }

  try {
    const body = await request.json().catch(() => null) as { token?: unknown } | null;
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Invalid or expired Studio handoff.' }, { status: 401, headers });
    }

    await connectToDatabase();
    const now = new Date();
    const handoff = await StudioHandoff.findOneAndUpdate(
      { tokenHash: sha256(token), usedAt: { $exists: false }, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { returnDocument: 'after' },
    );
    if (!handoff) {
      return NextResponse.json({ error: 'Invalid or expired Studio handoff.' }, { status: 401, headers });
    }

    const instance = await ManagedDatabase.findOne({
      _id: handoff.instanceId,
      customerId: handoff.customerId,
      status: { $in: ['ACTIVE', 'RUNNING'] },
    }).lean();
    if (!instance?.encryptedConnectionUri) {
      return NextResponse.json({ error: 'The database connection is no longer available.' }, { status: 409, headers });
    }

    let connectionDatabaseName = instance.databaseName;
    if (instance.planId === 'free' || instance.type === 'shared') {
      const sharedTenantId = instance.sharedTenantId || instance.providerDeploymentId;
      if (!sharedTenantId) {
        return NextResponse.json({ error: 'The shared tenant connection is no longer available.' }, { status: 409, headers });
      }
      const ownedTenant = await getOwnedSharedTenant(instance.customerId.toString(), sharedTenantId, false);
      if (!['ACTIVE', 'QUOTA_EXCEEDED'].includes(ownedTenant.tenant.status)) {
        return NextResponse.json({ error: 'The shared allocation is not active.' }, { status: 409, headers });
      }
      connectionDatabaseName = getSharedTenantLogicalDatabaseName(
        ownedTenant.tenant,
        ownedTenant.database?.databaseName || instance.name,
      );
    }
    if (!connectionDatabaseName) {
      return NextResponse.json({ error: 'The database connection is no longer available.' }, { status: 409, headers });
    }

    const parsed = parseLioranDBConnectionUri(decrypt(instance.encryptedConnectionUri));
    if (!parsed.username || parsed.password === undefined) {
      return NextResponse.json({ error: 'The database connection is no longer available.' }, { status: 409, headers });
    }

    // Rebuild the path from the Dashboard allocation record. A path is context,
    // not authorization; Rust still enforces tenant ownership at connection time.
    const connectionUri = buildLioranDBConnectionUri({
      scheme: parsed.scheme,
      username: parsed.username,
      password: parsed.password,
      host: instance.host || parsed.host,
      port: instance.port || parsed.port,
      database: connectionDatabaseName,
      tls: parsed.tls,
      transport: parsed.transport,
      allowHttpFallback: parsed.allowHttpFallback,
      appName: parsed.appName,
      authSource: parsed.authSource,
    });

    return NextResponse.json(
      { connectionUri, databaseName: connectionDatabaseName, instanceId: instance._id.toString() },
      { headers: { ...headers, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid or expired Studio handoff.' }, { status: 401, headers });
  }
}
