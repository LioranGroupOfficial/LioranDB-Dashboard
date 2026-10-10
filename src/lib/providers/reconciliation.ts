import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { isLocalhost, resolveControlPlaneEndpoint } from '@/lib/liorandb-admin/url';

/**
 * Authoritatively reconciles hosting node inventory, allocation status,
 * legacy port configurations, and live health status against real instances.
 */
export async function reconcileHostingNodes(): Promise<void> {
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

  // 3. Reconcile orphan nodes that have no active instances
  const allInstances = await ManagedDatabase.find().select('status hostingNodeId').lean();
  const activeInstances = allInstances.filter(
    (inst) => inst.status !== 'TERMINATED' && inst.status !== 'DELETED' && Boolean(inst.hostingNodeId)
  );

  const occupiedNodeIds = activeInstances
    .map((inst) => inst.hostingNodeId?.toString())
    .filter((id): id is string => Boolean(id));

  const occupiedSet = new Set(occupiedNodeIds);

  // 4. Safely inspect and sanitize unassigned nodes
  const unassignedNodes = allNodes.filter(
    (node) => !occupiedSet.has(node._id.toString()) && node.status !== 'DISABLED'
  );

  for (const node of unassignedNodes) {
    try {
      const client = LioranDBAdminClient.forNode(node);
      const cleanCheck = await client.verifyCleanState(node.serverIdentity);

      if (cleanCheck.isClean) {
        node.healthStatus = 'HEALTHY';
        node.status = 'AVAILABLE';
        node.currentAssignedCount = 0;
        node.serverIdentity = cleanCheck.status?.instanceId || node.serverIdentity;
        node.serverVersion = cleanCheck.status?.version || node.serverVersion;
        node.lastHealthCheckAt = new Date();
        await node.save();
      } else {
        // If unassigned node is not clean (e.g. residual data or users), execute purge
        console.warn(`[Reconciliation] Unassigned node ${node.name} not clean (${cleanCheck.reason}), executing tenant purge...`);
        const purgeRes = await client.purgeAndResetTenant({
          instanceId: node.serverIdentity || 'node-1',
        });

        if (purgeRes.success) {
          node.healthStatus = 'HEALTHY';
          node.status = 'AVAILABLE';
          node.currentAssignedCount = 0;
          node.lastResetAt = new Date();
          node.lastHealthCheckAt = new Date();
          await node.save();
        } else {
          // If purge fails, mark QUARANTINED
          node.healthStatus = 'DEGRADED';
          node.status = 'QUARANTINED';
          node.notes = `QUARANTINED on reconciliation: ${purgeRes.error}`;
          node.currentAssignedCount = 0;
          await node.save();
        }
      }
    } catch (err) {
      // If node is unreachable or error occurs, quarantine it rather than making it AVAILABLE
      if (node.status !== 'QUARANTINED' && node.status !== 'DISABLED') {
        node.healthStatus = 'UNREACHABLE';
        node.status = 'QUARANTINED';
        node.notes = `QUARANTINED on reconciliation probe failure: ${(err as Error).message}`;
        await node.save();
      }
    }
  }
}

