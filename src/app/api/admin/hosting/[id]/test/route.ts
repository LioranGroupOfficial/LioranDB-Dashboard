import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { LioranDBAuthenticationError, LioranDBForbiddenError } from '@/lib/liorandb-admin/errors';

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

      let cleanCheckResult = null;
      // Never run clean-for-reassignment check against ASSIGNED, PROVISIONING, RESERVED, or RESETTING nodes
      const isUnassignedForRecheck = !['ASSIGNED', 'PROVISIONING', 'RESERVED', 'RESETTING'].includes(node.status);

      if (isHealthy && isUnassignedForRecheck) {
        try {
          const cleanRes = await client.verifyCleanState(node.serverIdentity);
          cleanCheckResult = cleanRes;
          node.lastCleanCheckAt = new Date();
          if (cleanRes.isClean) {
            node.cleanStatus = 'CLEAN';
            node.cleanupFailureReason = undefined;
          } else {
            node.cleanStatus = cleanRes.verificationStatus === 'CLEAN_STATE_API_UNAVAILABLE' ? 'PENDING_VERIFICATION' : 'DIRTY';
            node.cleanupFailureReason = cleanRes.reason || cleanRes.reasons.join('; ');
          }
        } catch {
          // ignore clean-state probe failure during health test
        }
      }

      // Health test updates physical healthStatus only.
      // Health check MUST NOT automatically clear quarantine or recover status without an authorized lifecycle transition.
      await HostingNode.findByIdAndUpdate(node._id, {
        $set: {
          healthStatus: node.healthStatus,
          serverIdentity: node.serverIdentity,
          serverVersion: node.serverVersion,
          lastHealthCheckAt: node.lastHealthCheckAt,
          ...(isUnassignedForRecheck ? {
            cleanStatus: node.cleanStatus,
            cleanupFailureReason: node.cleanupFailureReason,
            lastCleanCheckAt: node.lastCleanCheckAt,
          } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        healthy: isHealthy,
        healthStatus: node.healthStatus,
        cleanStatus: node.cleanStatus,
        isClean: cleanCheckResult?.isClean,
        cleanReasons: cleanCheckResult?.reasons,
        status: node.status,
        serverIdentity: statusRes.instanceId,
        serverVersion: statusRes.version,
        uptimeSeconds: statusRes.uptimeSeconds,
        databaseCount: statusRes.databaseCount,
        storageBytes: statusRes.storageBytes,
        engineStatus: statusRes.rawEngineStatus,
        latencyMs,
        endpoint: client.endpoint,
        message: `Connection to ${node.name} succeeded (${latencyMs}ms). Health: ${node.healthStatus}, Clean: ${node.cleanStatus || 'UNKNOWN'}.`,
      });
    } catch (testErr: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMsg = testErr instanceof Error ? testErr.message : 'Connection failed';
      let failureReason: 'BEARER_AUTH_FAILED' | 'GATEWAY_AUTH_FAILED' | 'UNREACHABLE' = 'UNREACHABLE';

      if (testErr instanceof LioranDBAuthenticationError || (testErr as any)?.statusCode === 401 || errMsg.includes('401')) {
        node.healthStatus = 'AUTHENTICATION_FAILED';
        failureReason = 'BEARER_AUTH_FAILED';
      } else if (testErr instanceof LioranDBForbiddenError || (testErr as any)?.statusCode === 403 || errMsg.includes('403')) {
        node.healthStatus = 'AUTHENTICATION_FAILED';
        failureReason = 'GATEWAY_AUTH_FAILED';
      } else {
        node.healthStatus = 'UNREACHABLE';
        failureReason = 'UNREACHABLE';
      }
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

