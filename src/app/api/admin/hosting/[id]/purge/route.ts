import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { LioranDBAdminClient, logCleanupStage } from '@/lib/liorandb-admin/client';

/**
 * Explicit administrator-authorized recovery action:
 * Purges, sanitizes, and verifies clean state on an unassigned hosting node to release quarantine.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    await connectToDatabase();

    const node = await HostingNode.findById(id);
    if (!node) {
      return NextResponse.json({ error: 'Hosting node not found' }, { status: 404 });
    }

    // Safety check 1: Never purge a node with active customer databases
    const activeDatabases = await ManagedDatabase.countDocuments({
      hostingNodeId: node._id,
      status: { $nin: ['TERMINATED', 'DELETED'] },
    });

    if (activeDatabases > 0) {
      return NextResponse.json(
        {
          error: `Cannot purge hosting node: ${activeDatabases} active customer database(s) are assigned to this node. Terminate databases first.`,
        },
        { status: 400 }
      );
    }

    // Safety check 2: Prevent concurrent reset operations on the same node
    if (node.status === 'RESETTING') {
      return NextResponse.json(
        { error: 'A purge and reset operation is already in progress on this hosting node.' },
        { status: 409 }
      );
    }

    // Lock node to RESETTING before destructive operations
    node.status = 'RESETTING';
    await node.save();

    logCleanupStage({
      stage: 'LOCK_NODE',
      instanceId: node.serverIdentity || node._id.toString(),
      nodeId: node._id.toString(),
      endpoint: node.controlPlaneEndpoint || node.dbUrl,
    });

    const client = LioranDBAdminClient.forNode(node);
    const purgeResult = await client.purgeAndResetTenant({
      instanceId: node.serverIdentity || 'node-1',
      expectedInstanceName: node.name,
      nodeId: node._id.toString(),
    });

    const now = new Date();

    if (purgeResult.verifiedClean) {
      node.status = 'AVAILABLE';
      node.cleanStatus = 'CLEAN';
      node.healthStatus = 'HEALTHY';
      node.currentAssignedCount = 0;
      node.quarantineReason = undefined;
      node.cleanupFailureReason = undefined;
      node.lastResetAt = now;
      node.lastCleanCheckAt = now;
      node.lastHealthCheckAt = now;
      if (purgeResult.rotatedRootPassword) {
        node.lastCredentialRotationAt = now;
      }
      node.adminNotes = `Admin-authorized tenant purge completed on ${now.toISOString()}. Node verified clean and released for allocation.`;
      await node.save();

      logCleanupStage({
        stage: 'NODE_RELEASE',
        instanceId: node.serverIdentity,
        nodeId: node._id.toString(),
        endpoint: client.endpoint,
        isClean: true,
      });

      await createAuditLog({
        userId: admin.userId,
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: node._id.toString(),
        metadata: {
          action: 'PURGE_AND_RELEASE',
          nodeName: node.name,
          status: 'AVAILABLE',
          cleanStatus: 'CLEAN',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Hosting node "${node.name}" was successfully purged, sanitized, verified clean, and released for customer allocation.`,
        purgeResult,
      });
    } else {
      // Purge or clean verification failed: leave node safely QUARANTINED
      node.status = 'QUARANTINED';
      node.cleanStatus = 'DIRTY';
      node.healthStatus = 'DEGRADED';
      node.currentAssignedCount = 0;
      node.quarantineReason = purgeResult.error || 'Clean state verification failed post-reset';
      node.cleanupFailureReason = node.quarantineReason;
      node.lastCleanCheckAt = now;
      node.adminNotes = `QUARANTINED: Admin-authorized purge failed: ${node.quarantineReason}`;
      await node.save();

      logCleanupStage({
        stage: 'NODE_QUARANTINE',
        instanceId: node.serverIdentity,
        nodeId: node._id.toString(),
        endpoint: client.endpoint,
        isClean: false,
        failureReason: node.quarantineReason,
      });

      await createAuditLog({
        userId: admin.userId,
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: node._id.toString(),
        metadata: {
          action: 'PURGE_FAILED_QUARANTINED',
          nodeName: node.name,
          error: node.quarantineReason,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Purge completed but post-reset verification failed: ${purgeResult.error}. Node remains quarantined.`,
          purgeResult,
        },
        { status: 422 }
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Tenant purge failed';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
