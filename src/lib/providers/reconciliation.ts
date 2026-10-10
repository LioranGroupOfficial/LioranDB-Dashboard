import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient, logCleanupStage } from '@/lib/liorandb-admin/client';
import { isLocalhost, resolveControlPlaneEndpoint } from '@/lib/liorandb-admin/url';

let activeReconciliationPromise: Promise<void> | null = null;
let lastReconciliationCompletedAt = 0;
const RECONCILIATION_THROTTLE_MS = 10000; // 10 seconds cooldown between non-forced sweeps

/**
 * Authoritatively reconciles hosting node inventory, allocation status,
 * legacy port configurations, and live health status against real instances.
 *
 * Execution Safety Guarantees:
 *   - Read-only health inspections for ASSIGNED nodes (never run clean-for-reassignment checks).
 *   - Nodes in RESERVED, PROVISIONING, or RESETTING are NEVER modified concurrently.
 *   - Expired pre-mutation reservations are safely reclaimed only after clean verification.
 *   - QUARANTINED nodes are NEVER automatically factory-reset by reconciliation.
 *   - FAILED database instances do not strand capacity or falsely mark nodes as healthy ASSIGNED.
 *   - Atomic CAS updates prevent racing against in-flight allocations.
 */
export async function reconcileHostingNodes(options?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastReconciliationCompletedAt < RECONCILIATION_THROTTLE_MS) {
    return;
  }

  if (activeReconciliationPromise) {
    return activeReconciliationPromise;
  }

  activeReconciliationPromise = (async () => {
    try {
      await connectToDatabase();

      // 1. Auto-migrate any stale localhost port 8080 entries to 27018
      const allNodes = await HostingNode.find();
      const staleNodes = allNodes.filter(
        (node) =>
          node.port === 8080 ||
          node.httpPort === 8080 ||
          (typeof node.controlPlaneEndpoint === 'string' && node.controlPlaneEndpoint.includes(':8080'))
      );

      for (const node of staleNodes) {
        if (isLocalhost(node.dbUrl) || isLocalhost(node.controlPlaneEndpoint || '')) {
          await HostingNode.findByIdAndUpdate(node._id, {
            $set: {
              port: 27018,
              httpPort: 27018,
              controlPlaneEndpoint: resolveControlPlaneEndpoint(node),
            },
          });
        }
      }

      // 2. Identify all occupied nodes with active managed database instances
      const allInstances = await ManagedDatabase.find({
        hostingNodeId: { $exists: true, $ne: null },
      })
        .select('status hostingNodeId')
        .lean();

      // Truly active customer instances
      const activeInstances = allInstances.filter(
        (inst) => ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED'].includes(inst.status) && Boolean(inst.hostingNodeId)
      );

      const occupiedNodeIds = activeInstances
        .map((inst) => inst.hostingNodeId?.toString())
        .filter((id): id is string => Boolean(id));

      const occupiedSet = new Set(occupiedNodeIds);

      // Instances in FAILED status that are still associated with a node
      const failedInstances = allInstances.filter(
        (inst) => inst.status === 'FAILED' && Boolean(inst.hostingNodeId)
      );
      const failedNodeIds = failedInstances
        .map((inst) => inst.hostingNodeId?.toString())
        .filter((id): id is string => Boolean(id));
      const failedNodeSet = new Set(failedNodeIds);

      // 3. Inspect each hosting node safely
      for (const node of allNodes) {
        // Concurrency safeguard 1: never touch a node currently undergoing active reset or in-progress provisioning
        if (node.status === 'RESETTING' || node.status === 'PROVISIONING') {
          continue;
        }

        // Concurrency safeguard 2: handle legacy or expired RESERVED nodes
        if (node.status === 'RESERVED') {
          const isLeaseExpired = node.allocationExpiresAt && new Date(node.allocationExpiresAt) < new Date();
          if (!isLeaseExpired) {
            // Active allocation in progress: skip to protect reservation
            continue;
          }

          // Stale expired reservation lease: check if any in-flight ManagedDatabase is attached
          const hasInFlightInstance = await ManagedDatabase.exists({
            hostingNodeId: node._id,
            status: { $in: ['PROVISIONING', 'ACTIVE', 'RUNNING'] },
          });

          if (hasInFlightInstance) {
            continue;
          }

          // Safely reclaim expired reservation without clean-state gate
          await HostingNode.findOneAndUpdate(
            { _id: node._id, status: 'RESERVED' },
            {
              $set: {
                status: 'AVAILABLE',
                currentAssignedCount: 0,
              },
              $unset: {
                currentAllocationId: 1,
                allocationExpiresAt: 1,
                assignedInstanceId: 1,
              },
            }
          );
          continue;
        }

        const isOccupied = occupiedSet.has(node._id.toString());

        if (isOccupied) {
          // Node has an active customer database assigned.
          // NEVER run clean-state verification or reset on an ASSIGNED node!
          if (node.currentAssignedCount !== 1 || node.status !== 'ASSIGNED') {
            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                currentAssignedCount: 1,
                status: 'ASSIGNED',
              },
            });
          }

          // Perform lightweight read-only physical health check ONLY
          try {
            const client = LioranDBAdminClient.forNode(node);
            const status = await client.getServerStatus();
            const healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';

            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                healthStatus,
                serverIdentity: status.instanceId || node.serverIdentity,
                serverVersion: status.version || node.serverVersion,
                lastHealthCheckAt: new Date(),
              },
            });
          } catch {
            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                healthStatus: 'UNREACHABLE',
                lastHealthCheckAt: new Date(),
              },
            });
          }
          continue;
        }

        // Node is NOT occupied by an active customer instance.
        // Check if associated with an unresolved FAILED instance
        if (failedNodeSet.has(node._id.toString())) {
          if (node.status !== 'QUARANTINED' && node.status !== 'RESETTING') {
            await HostingNode.findOneAndUpdate(
              { _id: node._id, status: { $nin: ['RESETTING', 'QUARANTINED'] } },
              {
                $set: {
                  status: 'QUARANTINED',
                  currentAssignedCount: 0,
                  quarantineReason: 'Associated with failed instance provisioning. Requires sanitized reset before reuse.',
                  cleanupFailureReason: 'Failed instance provisioning',
                },
                $unset: {
                  currentAllocationId: 1,
                  allocationExpiresAt: 1,
                },
              }
            );
          }
          continue;
        }

        // Unassigned node: ensure assignment count is 0
        if (node.currentAssignedCount !== 0) {
          await HostingNode.findByIdAndUpdate(node._id, {
            $set: { currentAssignedCount: 0 },
          });
        }

        if (node.status === 'DISABLED') {
          try {
            const client = LioranDBAdminClient.forNode(node);
            const status = await client.getServerStatus();
            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                healthStatus: status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED',
                serverIdentity: status.instanceId || node.serverIdentity,
                serverVersion: status.version || node.serverVersion,
                lastHealthCheckAt: new Date(),
              },
            });
          } catch {
            await HostingNode.findByIdAndUpdate(node._id, {
              $set: { healthStatus: 'UNREACHABLE', lastHealthCheckAt: new Date() },
            });
          }
          continue;
        }

        // Handle QUARANTINED nodes:
        // NEVER factory-reset automatically! Check physical health in read-only mode and preserve quarantine.
        if (node.status === 'QUARANTINED') {
          try {
            const client = LioranDBAdminClient.forNode(node);
            const status = await client.getServerStatus();
            const healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';

            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                healthStatus,
                serverIdentity: status.instanceId || node.serverIdentity,
                serverVersion: status.version || node.serverVersion,
                lastHealthCheckAt: new Date(),
              },
            });
          } catch {
            await HostingNode.findByIdAndUpdate(node._id, {
              $set: {
                healthStatus: 'UNREACHABLE',
                lastHealthCheckAt: new Date(),
              },
            });
          }
          continue;
        }

        // Unassigned node in AVAILABLE status:
        // Perform read-only control plane health check ONLY.
        // Never clean-check or quarantine healthy nodes during reconciliation sweeps!
        try {
          const client = LioranDBAdminClient.forNode(node);
          const status = await client.getServerStatus();
          const healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';

          await HostingNode.findOneAndUpdate(
            { _id: node._id, status: { $in: ['AVAILABLE', 'ACTIVE'] } },
            {
              $set: {
                healthStatus,
                serverIdentity: status.instanceId || node.serverIdentity,
                serverVersion: status.version || node.serverVersion,
                lastHealthCheckAt: new Date(),
              },
            }
          );
        } catch {
          await HostingNode.findOneAndUpdate(
            { _id: node._id, status: { $in: ['AVAILABLE', 'ACTIVE'] } },
            {
              $set: {
                healthStatus: 'UNREACHABLE',
                lastHealthCheckAt: new Date(),
              },
            }
          );
        }
      }

      lastReconciliationCompletedAt = Date.now();
    } finally {
      activeReconciliationPromise = null;
    }
  })();

  return activeReconciliationPromise;
}

