import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { resolveControlPlaneEndpoint } from '@/lib/liorandb-admin/url';

export async function POST(req: NextRequest) {
  try {
    await requireAdminAPI();

    const body = await req.json();
    const { endpoint, host, port, protocol, token } = body;

    let targetEndpoint = endpoint;
    if (!targetEndpoint && host) {
      targetEndpoint = resolveControlPlaneEndpoint({
        dbUrl: host,
        port: Number(port) || 27018,
        protocol: protocol || 'http',
        httpPort: Number(port) || 27018,
      });
    }

    if (!targetEndpoint) {
      return NextResponse.json({ error: 'Endpoint or Host is required' }, { status: 400 });
    }

    const client = new LioranDBAdminClient({
      endpoint: targetEndpoint,
      controlPlaneToken: token?.trim() || process.env.LIORANDB_CONTROL_PLANE_TOKEN,
      timeoutMs: 6000,
    });

    const startTime = Date.now();
    try {
      const statusRes = await client.getServerStatus();
      const latencyMs = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        healthy: statusRes.status === 'HEALTHY',
        status: statusRes.status,
        serverIdentity: statusRes.instanceId,
        serverVersion: statusRes.version,
        uptimeSeconds: statusRes.uptimeSeconds,
        databaseCount: statusRes.databaseCount,
        storageBytes: statusRes.storageBytes,
        engineStatus: statusRes.rawEngineStatus,
        latencyMs,
        endpoint: client.endpoint,
        message: `Successfully connected to LioranDB Rust node (${latencyMs}ms).`,
      });
    } catch (testErr: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMsg = testErr instanceof Error ? testErr.message : 'Connection test failed';
      return NextResponse.json({
        success: false,
        healthy: false,
        latencyMs,
        endpoint: client.endpoint,
        error: errMsg,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

