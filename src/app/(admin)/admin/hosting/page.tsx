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
        defaultRootPassword: n.defaultRootPassword || '',
        status: n.status,
        maxCapacity: 1,
        currentAssignedCount: assignedCount,
        assignedInstanceName: activeInstance?.name || undefined,
        assignedInstanceStatus: activeInstance?.status || undefined,
        assignedDatabaseId: activeInstance?._id?.toString() || undefined,
        notes: n.notes || '',
        isDefault: Boolean(n.isDefault),
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
      };
    })
  );

  return <AdminHostingClient initialNodes={formattedNodes} />;
}
