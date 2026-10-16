import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { LioranDBAuthenticationError, LioranDBForbiddenError } from '@/lib/liorandb-admin/errors';
import { extractDockerNodeId, getDockerManagementClient, isAllowedDockerNodeId } from '@/lib/docker-management';

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

    // Inspect Docker container state if matching cx01..cx07
    const dockerNodeId = node.dockerNodeId || extractDockerNodeId({
      slug: node.slug,
      name: node.name,
      dbUrl: node.dbUrl,
    });

    let dockerInfo: {
      checked: boolean;
      status?: string;
      running?: boolean;
      error?: string;
    } = { checked: false };

    if (dockerNodeId && isAllowedDockerNodeId(dockerNodeId)) {
      try {
        const dockerClient = getDockerManagementClient();
        if (dockerClient.isConfigured()) {
          const dState = await dockerClient.getNodeState(dockerNodeId);
          dockerInfo = {
            checked: true,
            status: dState.status,
            running: dState.running,
          };
          node.dockerNodeId = dockerNodeId;
          node.dockerStatus = dState.status;
          node.dockerRunning = dState.running;
          node.dockerLastInspectedAt = new Date();
        }
      } catch (dErr: unknown) {
        dockerInfo = {
          checked: true,
          error: dErr instanceof Error ? dErr.message : 'Docker inspection failed',
        };
      }
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

      await HostingNode.findByIdAndUpdate(node._id, {
        $set: {
          healthStatus: node.healthStatus,
          serverIdentity: node.serverIdentity,
          serverVersion: node.serverVersion,
          lastHealthCheckAt: node.lastHealthCheckAt,
          dockerNodeId: node.dockerNodeId,
          dockerStatus: node.dockerStatus,
          dockerRunning: node.dockerRunning,
          dockerLastInspectedAt: node.dockerLastInspectedAt,
        },
      });

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
        docker: dockerInfo,
        cleanStatus: node.cleanStatus || 'NOT_VERIFIED',
        volumeCleanVerified: Boolean(node.volumeCleanVerified),
        message: `Connection to ${node.name} succeeded (${latencyMs}ms). Health: ${node.healthStatus}.`,
      });
    } catch (testErr: unknown) {
      const latencyMs = Date.now() - startTime;
      const rawErrMsg = testErr instanceof Error ? testErr.message : 'Connection failed';
      let failureReason: 'BEARER_AUTH_FAILED' | 'GATEWAY_AUTH_FAILED' | 'UNREACHABLE' = 'UNREACHABLE';

      if (testErr instanceof LioranDBAuthenticationError || (testErr as any)?.statusCode === 401 || rawErrMsg.includes('401')) {
        node.healthStatus = 'AUTHENTICATION_FAILED';
        failureReason = 'BEARER_AUTH_FAILED';
      } else if (testErr instanceof LioranDBForbiddenError || (testErr as any)?.statusCode === 403 || rawErrMsg.includes('403')) {
        node.healthStatus = 'AUTHENTICATION_FAILED';
        failureReason = 'GATEWAY_AUTH_FAILED';
      } else {
        node.healthStatus = 'UNREACHABLE';
        failureReason = 'UNREACHABLE';
      }
      node.lastHealthCheckAt = new Date();

      await HostingNode.findByIdAndUpdate(node._id, {
        $set: {
          healthStatus: node.healthStatus,
          lastHealthCheckAt: node.lastHealthCheckAt,
          dockerNodeId: node.dockerNodeId,
          dockerStatus: node.dockerStatus,
          dockerRunning: node.dockerRunning,
          dockerLastInspectedAt: node.dockerLastInspectedAt,
        },
      });

      const displayError =
        dockerInfo.checked && dockerInfo.running === false
          ? `Docker container "${node.dockerContainerName || node.name}" is ${dockerInfo.status || 'stopped'}. Rust control plane is offline. Use "Recover Node" to start the container.`
          : rawErrMsg;

      return NextResponse.json(
        {
          success: false,
          healthy: false,
          healthStatus: node.healthStatus,
          status: node.status,
          latencyMs,
          endpoint: client.endpoint,
          docker: dockerInfo,
          cleanStatus: node.cleanStatus || 'NOT_VERIFIED',
          volumeCleanVerified: Boolean(node.volumeCleanVerified),
          error: displayError,
          errorType: failureReason,
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

