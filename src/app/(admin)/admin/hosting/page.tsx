import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase, IHostingNode } from '@/lib/db';
import AdminHostingClient, { AdminHostingNodeItem } from './AdminHostingClient';

export const metadata = { title: 'Database Hosting Nodes — Admin' };

export default async function AdminHostingPage() {
  await requireAdmin();
  await connectToDatabase();

  const nodes = await HostingNode.find().sort({ createdAt: -1 }).lean<IHostingNode[]>();

  const formattedNodes: AdminHostingNodeItem[] = await Promise.all(
    nodes.map(async (n) => {
      const activeInstance = await ManagedDatabase.findOne({
        hostingNodeId: n._id,
        status: { $nin: ['TERMINATED', 'DELETED'] },
      })
        .select('name status _id')
        .lean();

      const assignedCount = activeInstance ? 1 : 0;

      return {
        _id: n._id.toString(),
        name: n.name,
        slug: n.slug,
        region: n.region || 'Asia (Mumbai)',
        dbUrl: n.dbUrl,
        port: n.port || 27017,
        protocol: n.protocol || 'https',
        httpPort: n.httpPort || 443,
        grpcUrl: n.grpcUrl,
        grpcPort: n.grpcPort || 50051,
        defaultRootUsername: n.defaultRootUsername || 'admin',
        controlPlaneEndpoint: n.controlPlaneEndpoint || `${n.protocol || 'http'}://${n.dbUrl}:${n.httpPort || 27018}`,
        healthStatus: n.healthStatus || 'UNKNOWN',
        serverIdentity: n.serverIdentity,
        serverVersion: n.serverVersion || '2.4.1',
        allocationMode: n.allocationMode || 'DEDICATED',
        status: n.status,
        maxCapacity: 1,
        currentAssignedCount: assignedCount,
        assignedInstanceName: activeInstance?.name || undefined,
        assignedInstanceStatus: activeInstance?.status || undefined,
        assignedDatabaseId: activeInstance?._id?.toString() || undefined,
        lastHealthCheckAt: n.lastHealthCheckAt ? new Date(n.lastHealthCheckAt).toISOString() : undefined,
        lastResetAt: n.lastResetAt ? new Date(n.lastResetAt).toISOString() : undefined,
        lastCredentialRotationAt: n.lastCredentialRotationAt ? new Date(n.lastCredentialRotationAt).toISOString() : undefined,
        notes: n.notes || '',
        isDefault: Boolean(n.isDefault),
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
      };
    })
  );

  return <AdminHostingClient initialNodes={formattedNodes} />;
}
