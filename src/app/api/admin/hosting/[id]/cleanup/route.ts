import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';

/**
 * Explicit Administrator-Approved Hosting Node Recovery & Tenant Purge API
 *
 * Safely executes authoritative engine reset, fresh root credential capture,
 * and clean-state verification on demand for quarantined or unassigned hosting nodes.
 * Enforces atomic concurrency locking and checks that no customer databases are assigned.
 */
export async function POST(
  _req: NextRequest,
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

    // Safety constraint: Never reset a node that has genuinely active customer databases
    const activeInstancesCount = await ManagedDatabase.countDocuments({
      hostingNodeId: node._id,
      status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED'] },
    });

    if (activeInstancesCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot sanitize hosting node: ${activeInstancesCount} active customer database(s) are assigned to this node. Drain or delete active databases first.`,
        },
        { status: 400 }
      );
    }

    // Concurrency protection: Atomically acquire exclusive reset lock
    const lockedNode = await HostingNode.findOneAndUpdate(
      {
        _id: node._id,
        status: { $ne: 'RESETTING' },
      },
      {
        $set: {
          status: 'RESETTING',
          lastCleanupAttemptAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!lockedNode) {
      return NextResponse.json(
        { error: 'Node is currently undergoing an active reset or cleanup operation. Please wait.' },
        { status: 409 }
      );
    }

    const now = new Date();
    const client = LioranDBAdminClient.forNode(lockedNode);
    const targetCloudInstanceId = lockedNode.serverIdentity || 'primary';

    const purgeResult = await client.purgeAndResetTenant({
      instanceId: targetCloudInstanceId,
      expectedInstanceName: lockedNode.name,
      nodeId: lockedNode._id.toString(),
    });

    if (purgeResult.success && purgeResult.verifiedClean) {
      lockedNode.status = 'AVAILABLE';
      lockedNode.healthStatus = 'HEALTHY';
      lockedNode.quarantineReason = undefined;
      lockedNode.cleanupFailureReason = undefined;
      lockedNode.currentAssignedCount = 0;
      lockedNode.currentAllocationId = undefined;
      lockedNode.allocationExpiresAt = undefined;
      lockedNode.assignedInstanceId = undefined;
      lockedNode.lastResetAt = now;
      if (purgeResult.rotatedRootPassword) {
        lockedNode.lastCredentialRotationAt = now;
      }
      lockedNode.adminNotes = `Administrator cleanup succeeded on ${now.toISOString()} by ${admin.email || admin.userId}. Engine reset verified.`;
      await lockedNode.save();

      // Clean up any residual non-active instance records linked to this node
      await ManagedDatabase.updateMany(
        { hostingNodeId: lockedNode._id, status: { $nin: ['ACTIVE', 'RUNNING'] } },
        {
          $set: {
            status: 'TERMINATED',
            terminatedAt: now,
            terminationReason: 'Node sanitized and reset by administrator',
          },
          $unset: { hostingNodeId: 1 },
        }
      );

      await createAuditLog({
        userId: admin.userId,
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: lockedNode._id.toString(),
        metadata: {
          action: 'ADMIN_PURGE_AND_RESET_SUCCESS',
          nodeName: lockedNode.name,
          preResetMemory: purgeResult.preResetMemoryBytes,
          postResetMemory: purgeResult.postResetMemoryBytes,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Hosting node "${lockedNode.name}" was successfully sanitized. Quarantine released.`,
        purgeResult,
        node: lockedNode,
      });
    } else {
      // Post-cleanup verification failed or error occurred
      const failureReason = purgeResult.error?.includes('backup')
        ? `${lockedNode.name} requires reset: residual backup configuration.`
        : (purgeResult.error || 'Server reset failed.');
      lockedNode.status = 'QUARANTINED';
      lockedNode.healthStatus = 'DEGRADED';
      lockedNode.cleanupFailureReason = purgeResult.error || 'Server reset failed.';
      lockedNode.quarantineReason = failureReason;
      lockedNode.adminNotes = `Administrator cleanup failed on ${now.toISOString()}: ${failureReason}`;
      await lockedNode.save();

      await createAuditLog({
        userId: admin.userId,
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: lockedNode._id.toString(),
        metadata: {
          action: 'ADMIN_PURGE_AND_RESET_FAILED',
          nodeName: lockedNode.name,
          error: failureReason,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Server reset failed: ${failureReason}. Node remains quarantined.`,
          purgeResult,
          node: lockedNode,
        },
        { status: 422 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute node recovery';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
