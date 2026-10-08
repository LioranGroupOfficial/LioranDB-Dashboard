import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAPI();
    const { id } = await params;
    await connectToDatabase();

    const node = await HostingNode.findById(id);
    if (!node) {
      return NextResponse.json({ error: 'Hosting node not found' }, { status: 404 });
    }

    const client = LioranDBAdminClient.forNode(node);
    const startTime = Date.now();

    try {
      const statusRes = await client.getServerStatus();
      const latencyMs = Date.now() - startTime;

      const isHealthy = statusRes.status === 'HEALTHY';
      node.healthStatus = isHealthy ? 'HEALTHY' : 'DEGRADED';
      node.serverIdentity = statusRes.instanceId;
      node.serverVersion = statusRes.version || '2.4.1';
      node.lastHealthCheckAt = new Date();

      // If node was marked FAILED, recover to AVAILABLE if no active instances assigned
      if (node.status === 'FAILED') {
        const activeCount = await ManagedDatabase.countDocuments({
          hostingNodeId: node._id,
          status: { $nin: ['TERMINATED', 'DELETED'] },
        });
        node.status = activeCount > 0 ? 'ASSIGNED' : 'AVAILABLE';
      }

      await node.save();

      return NextResponse.json({
        success: true,
        healthy: isHealthy,
        healthStatus: node.healthStatus,
        status: node.status,
        serverIdentity: statusRes.instanceId,
        serverVersion: statusRes.version,
        uptimeSeconds: statusRes.uptimeSeconds,
        databaseCount: statusRes.databaseCount,
        storageBytes: statusRes.storageBytes,
        engineStatus: statusRes.rawEngineStatus,
        latencyMs,
        endpoint: client.endpoint,
        message: `Connection to ${node.name} succeeded (${latencyMs}ms).`,
      });
    } catch (testErr: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMsg = testErr instanceof Error ? testErr.message : 'Connection failed';
      const isAuthError =
        errMsg.toLowerCase().includes('auth') ||
        errMsg.toLowerCase().includes('401') ||
        errMsg.toLowerCase().includes('403') ||
        errMsg.toLowerCase().includes('unauthorized');

      node.healthStatus = isAuthError ? 'AUTHENTICATION_FAILED' : 'UNREACHABLE';
      node.lastHealthCheckAt = new Date();
      await node.save();

      return NextResponse.json(
        {
          success: false,
          healthy: false,
          healthStatus: node.healthStatus,
          status: node.status,
          latencyMs,
          endpoint: client.endpoint,
          error: errMsg,
        },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

