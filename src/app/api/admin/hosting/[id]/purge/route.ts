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

    // Lock node to RESETTING before destructive operations using atomic CAS
    const lockedNode = await HostingNode.findOneAndUpdate(
      {
        _id: node._id,
        status: { $nin: ['RESETTING', 'PROVISIONING', 'ASSIGNED'] },
        $or: [
          { currentAllocationId: { $exists: false } },
          { currentAllocationId: null },
          { allocationExpiresAt: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          status: 'RESETTING',
          lastCleanupAttemptAt: new Date(),
        },
        $unset: {
          currentAllocationId: 1,
          allocationExpiresAt: 1,
          assignedInstanceId: 1,
        },
      },
      { returnDocument: 'after' }
    );

    if (!lockedNode) {
      return NextResponse.json(
        { error: 'Cannot purge hosting node: it is currently active, assigned, reserved, or undergoing another reset operation.' },
        { status: 409 }
      );
    }

    logCleanupStage({
      stage: 'LOCK_NODE',
      instanceId: lockedNode.serverIdentity || lockedNode._id.toString(),
      nodeId: lockedNode._id.toString(),
      endpoint: lockedNode.controlPlaneEndpoint || lockedNode.dbUrl,
    });

    const client = LioranDBAdminClient.forNode(lockedNode);
    const purgeResult = await client.purgeAndResetTenant({
      instanceId: lockedNode.serverIdentity || 'node-1',
      expectedInstanceName: lockedNode.name,
      nodeId: lockedNode._id.toString(),
    });

    const now = new Date();

    if (purgeResult.verifiedClean) {
      await HostingNode.findOneAndUpdate(
        { _id: lockedNode._id, status: 'RESETTING' },
        {
          $set: {
            status: 'AVAILABLE',
            cleanStatus: 'CLEAN',
            healthStatus: 'HEALTHY',
            currentAssignedCount: 0,
            lastResetAt: now,
            lastCleanCheckAt: now,
            lastHealthCheckAt: now,
            ...(purgeResult.rotatedRootPassword ? { lastCredentialRotationAt: now } : {}),
            adminNotes: `Admin-authorized tenant purge completed on ${now.toISOString()}. Node verified clean and released for allocation.`,
          },
          $unset: {
            quarantineReason: 1,
            cleanupFailureReason: 1,
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
          },
        }
      );

      logCleanupStage({
        stage: 'NODE_RELEASE',
        instanceId: lockedNode.serverIdentity,
        nodeId: lockedNode._id.toString(),
        endpoint: client.endpoint,
        isClean: true,
      });

      await createAuditLog({
        userId: admin.userId,
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: lockedNode._id.toString(),
        metadata: {
          action: 'PURGE_AND_RELEASE',
          nodeName: lockedNode.name,
          status: 'AVAILABLE',
          cleanStatus: 'CLEAN',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Hosting node "${lockedNode.name}" was successfully purged, sanitized, verified clean, and released for customer allocation.`,
        purgeResult,
      });
    } else {
      // Purge or clean verification failed: leave node safely QUARANTINED
      await HostingNode.findOneAndUpdate(
        { _id: lockedNode._id, status: 'RESETTING' },
        {
          $set: {
            status: 'QUARANTINED',
            cleanStatus: 'DIRTY',
            healthStatus: 'DEGRADED',
            currentAssignedCount: 0,
            quarantineReason: purgeResult.error || 'Clean state verification failed post-reset',
            cleanupFailureReason: purgeResult.error || 'Clean state verification failed post-reset',
            lastCleanCheckAt: now,
            adminNotes: `QUARANTINED: Admin-authorized purge failed: ${purgeResult.error || 'Clean check failed'}`,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
          },
        }
      );

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
