import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase, IHostingNode } from '@/lib/db';
import { reconcileHostingNodes } from '@/lib/providers/reconciliation';
import { getHostingNodeAllocationSnapshot, getNodeMaxCapacity } from '@/lib/hosting/allocation';
import AdminHostingClient, { AdminHostingNodeItem } from './AdminHostingClient';

export const metadata = { title: 'Database Hosting Nodes — Admin' };

export default async function AdminHostingPage() {
  await requireAdmin();
  await connectToDatabase();
  await reconcileHostingNodes();

  const nodes = await HostingNode.find().sort({ createdAt: -1 }).lean<IHostingNode[]>();

  const formattedNodes: AdminHostingNodeItem[] = await Promise.all(
    nodes.map(async (n) => {
      const snapshot = await getHostingNodeAllocationSnapshot(n as any);
      const activeInstance = await ManagedDatabase.findOne({
        hostingNodeId: n._id,
        status: { $in: ['PENDING', 'PROVISIONING', 'ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED'] },
      })
        .select('name status _id')
        .lean();

      const provisioningInstance = !activeInstance
        ? await ManagedDatabase.findOne({
            hostingNodeId: n._id,
            status: 'PROVISIONING',
          })
            .select('name status _id')
            .lean()
        : null;

      const effectiveInstance = activeInstance || provisioningInstance;
      return {
        _id: n._id.toString(),
        name: n.name,
        slug: n.slug,
        region: n.region || 'Asia (Mumbai)',
        dbUrl: n.dbUrl,
        port: n.port || 27018,
        protocol: n.protocol || 'http',
        httpPort: n.httpPort || 27018,
        grpcUrl: n.grpcUrl,
        grpcPort: n.grpcPort || 27019,
        defaultRootUsername: n.defaultRootUsername || 'admin',
        controlPlaneEndpoint: n.controlPlaneEndpoint || `${n.protocol || 'http'}://${n.dbUrl}:${n.httpPort || 27018}`,
        healthStatus: n.healthStatus || 'UNKNOWN',
        serverIdentity: n.serverIdentity,
        serverVersion: n.serverVersion || '2.4.1',
        allocationMode: n.allocationMode || 'DEDICATED',
        status: n.status,
        maxCapacity: getNodeMaxCapacity(n as any),
        currentAssignedCount: snapshot.currentAssignedCount,
        pendingReservations: snapshot.pendingReservations,
        availableCapacity: snapshot.availableCapacity,
        assignedInstanceName: effectiveInstance?.name || undefined,
        assignedInstanceStatus: effectiveInstance?.status || undefined,
        assignedDatabaseId: effectiveInstance?._id?.toString() || undefined,
        lastHealthCheckAt: n.lastHealthCheckAt ? new Date(n.lastHealthCheckAt).toISOString() : undefined,
        lastResetAt: n.lastResetAt ? new Date(n.lastResetAt).toISOString() : undefined,
        lastCredentialRotationAt: n.lastCredentialRotationAt ? new Date(n.lastCredentialRotationAt).toISOString() : undefined,
        quarantineReason: (n as any).quarantineReason,
        cleanupFailureReason: (n as any).cleanupFailureReason,
        notes: n.notes || '',
        isDefault: Boolean(n.isDefault),
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
      };
    })
  );

  return <AdminHostingClient initialNodes={formattedNodes} />;
}
