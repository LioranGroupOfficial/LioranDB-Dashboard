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
 *   - Read-only health and clean-state inspections by default.
 *   - QUARANTINED nodes are NEVER automatically factory-reset by periodic reconciliation.
 *   - RESETTING nodes are never processed concurrently.
 *   - Concurrent callers share the in-flight reconciliation promise.
 *   - Failed inspections transition nodes to QUARANTINED without destructive loops.
 *   - Destructive cleanup is strictly reserved for tenant termination or administrator actions.
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
          node.port = 27018;
          node.httpPort = 27018;
          node.controlPlaneEndpoint = resolveControlPlaneEndpoint(node);
          await node.save();
        }
      }

      // 2. Identify all occupied nodes with active managed database instances
      const allInstances = await ManagedDatabase.find().select('status hostingNodeId').lean();
      const activeInstances = allInstances.filter(
        (inst) => inst.status !== 'TERMINATED' && inst.status !== 'DELETED' && Boolean(inst.hostingNodeId)
      );

      const occupiedNodeIds = activeInstances
        .map((inst) => inst.hostingNodeId?.toString())
        .filter((id): id is string => Boolean(id));

      const occupiedSet = new Set(occupiedNodeIds);

      // 3. Inspect each hosting node safely
      for (const node of allNodes) {
        // Concurrency safeguard: never touch a node currently undergoing active reset
        if (node.status === 'RESETTING') {
          continue;
        }

        const isOccupied = occupiedSet.has(node._id.toString());

        if (isOccupied) {
          // Node has an active customer database assigned
          if (node.currentAssignedCount !== 1 || node.status === 'AVAILABLE') {
            node.currentAssignedCount = 1;
            node.status = 'ASSIGNED';
            await node.save();
          }

          // Perform lightweight read-only health check
          try {
            const client = LioranDBAdminClient.forNode(node);
            const status = await client.getServerStatus();
            node.healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';
            node.serverIdentity = status.instanceId || node.serverIdentity;
            node.serverVersion = status.version || node.serverVersion;
            node.lastHealthCheckAt = new Date();
            await node.save();

            logCleanupStage({
              stage: 'HEALTH_INSPECTION',
              instanceId: node.serverIdentity,
              nodeId: node._id.toString(),
              endpoint: client.endpoint,
              isClean: false,
            });
          } catch {
            node.healthStatus = 'UNREACHABLE';
            node.lastHealthCheckAt = new Date();
            await node.save();
          }
          continue;
        }

        // Unassigned node: ensure assignment count is 0
        node.currentAssignedCount = 0;

        if (node.status === 'DISABLED') {
          await node.save();
          continue;
        }

        // Handle QUARANTINED nodes:
        // NEVER factory-reset automatically! Inspect health and clean state in read-only mode.
        if (node.status === 'QUARANTINED') {
          try {
            const client = LioranDBAdminClient.forNode(node);
            const status = await client.getServerStatus();
            node.healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';
            node.serverIdentity = status.instanceId || node.serverIdentity;
            node.serverVersion = status.version || node.serverVersion;
            node.lastHealthCheckAt = new Date();

            logCleanupStage({
              stage: 'HEALTH_INSPECTION',
              instanceId: node.serverIdentity,
              nodeId: node._id.toString(),
              endpoint: client.endpoint,
              isClean: node.cleanStatus === 'CLEAN',
            });

            // Read-only clean state verification probe
            const cleanCheck = await client.verifyCleanState(node.serverIdentity);
            node.lastCleanCheckAt = new Date();

            logCleanupStage({
              stage: 'CLEAN_STATE_INSPECTION',
              instanceId: node.serverIdentity,
              nodeId: node._id.toString(),
              endpoint: client.endpoint,
              isClean: cleanCheck.isClean,
              failureReason: cleanCheck.reason,
            });

            if (cleanCheck.isClean && node.healthStatus === 'HEALTHY') {
              // Authoritative clean state confirmed: safely release quarantine
              node.cleanStatus = 'CLEAN';
              node.status = 'AVAILABLE';
              node.quarantineReason = undefined;
              node.cleanupFailureReason = undefined;
              node.adminNotes = `Quarantine released by reconciliation on ${new Date().toISOString()}: verified clean state confirmed.`;

              logCleanupStage({
                stage: 'NODE_RELEASE',
                instanceId: node.serverIdentity,
                nodeId: node._id.toString(),
                endpoint: client.endpoint,
                isClean: true,
              });
            } else {
              // Maintain quarantine without destructive action
              node.cleanStatus = cleanCheck.verificationStatus === 'CLEAN_STATE_API_UNAVAILABLE' ? 'PENDING_VERIFICATION' : 'DIRTY';
              node.cleanupFailureReason = cleanCheck.reason || cleanCheck.reasons.join('; ');
              node.quarantineReason = node.cleanupFailureReason;
            }
            await node.save();
          } catch (err: unknown) {
            const errMsg = (err as Error).message || String(err);
            node.healthStatus = 'UNREACHABLE';
            node.lastHealthCheckAt = new Date();
            await node.save();
          }
          continue;
        }

        // Unassigned node in AVAILABLE, RESERVED, or other status:
        // Perform read-only health & clean inspection.
        try {
          const client = LioranDBAdminClient.forNode(node);
          const status = await client.getServerStatus();
          node.healthStatus = status.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';
          node.serverIdentity = status.instanceId || node.serverIdentity;
          node.serverVersion = status.version || node.serverVersion;
          node.lastHealthCheckAt = new Date();

          logCleanupStage({
            stage: 'HEALTH_INSPECTION',
            instanceId: node.serverIdentity,
            nodeId: node._id.toString(),
            endpoint: client.endpoint,
            isClean: node.cleanStatus === 'CLEAN',
          });

          const cleanCheck = await client.verifyCleanState(node.serverIdentity);
          node.lastCleanCheckAt = new Date();

          logCleanupStage({
            stage: 'CLEAN_STATE_INSPECTION',
            instanceId: node.serverIdentity,
            nodeId: node._id.toString(),
            endpoint: client.endpoint,
            isClean: cleanCheck.isClean,
            failureReason: cleanCheck.reason,
          });

          if (cleanCheck.isClean && node.healthStatus === 'HEALTHY') {
            node.cleanStatus = 'CLEAN';
            node.status = 'AVAILABLE';
            node.cleanupFailureReason = undefined;
            node.quarantineReason = undefined;
            await node.save();
          } else {
            // Failed clean inspection or clean-state contract unavailable:
            // Quarantine the node to protect customer isolation. DO NOT trigger destructive purge!
            node.cleanStatus = cleanCheck.verificationStatus === 'CLEAN_STATE_API_UNAVAILABLE' ? 'PENDING_VERIFICATION' : 'DIRTY';
            node.status = 'QUARANTINED';
            node.cleanupFailureReason = cleanCheck.reason || cleanCheck.reasons.join('; ');
            node.quarantineReason = node.cleanupFailureReason;
            node.adminNotes = `Quarantined by reconciliation inspection: ${node.cleanupFailureReason}`;

            logCleanupStage({
              stage: 'NODE_QUARANTINE',
              instanceId: node.serverIdentity,
              nodeId: node._id.toString(),
              endpoint: client.endpoint,
              isClean: false,
              failureReason: node.cleanupFailureReason,
            });

            await node.save();
          }
        } catch (err: unknown) {
          const errMsg = (err as Error).message || String(err);
          node.healthStatus = 'UNREACHABLE';
          node.status = 'QUARANTINED';
          node.cleanStatus = 'NOT_VERIFIED';
          node.cleanupFailureReason = `Probe failure: ${errMsg}`;
          node.quarantineReason = node.cleanupFailureReason;
          node.lastHealthCheckAt = new Date();
          await node.save();

          logCleanupStage({
            stage: 'NODE_QUARANTINE',
            instanceId: node.serverIdentity,
            nodeId: node._id.toString(),
            isClean: false,
            failureReason: errMsg,
          });
        }
      }

      lastReconciliationCompletedAt = Date.now();
    } finally {
      activeReconciliationPromise = null;
    }
  })();

  return activeReconciliationPromise;
}

