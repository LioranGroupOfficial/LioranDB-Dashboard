import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { isLocalhost, resolveControlPlaneEndpoint } from '@/lib/liorandb-admin/url';

/**
 * Authoritatively reconciles hosting node inventory, allocation status,
 * legacy port configurations, and live health status against real instances.
 */
export async function reconcileHostingNodes(): Promise<void> {
  await connectToDatabase();

  // 1. Auto-seed default localhost node if zero hosting nodes exist
  const totalNodesCount = await HostingNode.countDocuments();
  if (totalNodesCount === 0) {
    try {
      const defaultEndpoint = resolveControlPlaneEndpoint(null);
      await HostingNode.create({
        name: 'Localhost Node (127.0.0.1)',
        slug: 'localhost-node-01',
        region: 'Localhost / Development',
        dbUrl: '127.0.0.1',
        port: 27018,
        protocol: 'http',
        httpPort: 27018,
        grpcUrl: '127.0.0.1',
        grpcPort: 27019,
        controlPlaneEndpoint: defaultEndpoint,
        allocationMode: 'DEDICATED',
        status: 'AVAILABLE',
        healthStatus: 'HEALTHY',
        maxCapacity: 1,
        currentAssignedCount: 0,
        defaultRootUsername: 'admin',
        isDefault: true,
        notes: 'Auto-seeded default development node',
      });
    } catch {
      // Ignore concurrent seed race
    }
  }

  // 2. Auto-migrate any stale localhost port 8080 entries to 27018
  const staleNodes = await HostingNode.find({
    $or: [
      { controlPlaneEndpoint: /:8080/ },
      { httpPort: 8080 },
      { port: 8080 },
    ],
  });

  for (const node of staleNodes) {
    if (isLocalhost(node.dbUrl) || isLocalhost(node.controlPlaneEndpoint || '')) {
      node.port = 27018;
      node.httpPort = 27018;
      node.controlPlaneEndpoint = resolveControlPlaneEndpoint(node);
      await node.save();
    }
  }

  // 3. Reconcile orphan nodes that have no active instances
  const activeInstances = await ManagedDatabase.find({
    status: { $nin: ['TERMINATED', 'DELETED'] },
    hostingNodeId: { $exists: true, $ne: null },
  })
    .select('hostingNodeId')
    .lean();

  const occupiedNodeIds = activeInstances
    .map((inst) => inst.hostingNodeId?.toString())
    .filter((id): id is string => Boolean(id));

  const occupiedSet = new Set(occupiedNodeIds);

  // Unblock any unassigned node stuck in FAILED, PROVISIONING, ASSIGNED, or RESETTING
  await HostingNode.updateMany(
    {
      _id: { $nin: Array.from(occupiedSet) },
      status: { $in: ['PROVISIONING', 'ASSIGNED', 'RESETTING', 'FAILED', 'RESERVED'] },
    },
    {
      $set: {
        currentAssignedCount: 0,
        status: 'AVAILABLE',
      },
    }
  );

  // 4. Quick probe unassigned or degraded nodes to refresh health status
  const unassignedNodes = await HostingNode.find({
    _id: { $nin: Array.from(occupiedSet) },
    status: { $ne: 'DISABLED' },
  });

  for (const node of unassignedNodes) {
    try {
      const client = LioranDBAdminClient.forNode(node);
      const statusRes = await client.getServerStatus();
      if (statusRes.status === 'HEALTHY') {
        node.healthStatus = 'HEALTHY';
        node.status = 'AVAILABLE';
        node.serverIdentity = statusRes.instanceId || node.serverIdentity;
        node.serverVersion = statusRes.version || node.serverVersion;
        node.lastHealthCheckAt = new Date();
        await node.save();
      }
    } catch {
      // Leave existing health status if unreachable
    }
  }
}

