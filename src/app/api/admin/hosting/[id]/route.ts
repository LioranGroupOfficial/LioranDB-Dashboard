import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAPI();
    const { id } = await params;
    await connectToDatabase();

    const node = await HostingNode.findById(id).lean();
    if (!node) {
      return NextResponse.json({ error: 'Hosting node not found' }, { status: 404 });
    }

    const assignedInstances = await ManagedDatabase.find({
      hostingNodeId: node._id,
      status: { $nin: ['TERMINATED', 'DELETED'] },
    })
      .select('name status customerId planId createdAt')
      .lean();

    return NextResponse.json({
      success: true,
      node: {
        ...node,
        currentAssignedCount: assignedInstances.length,
        instances: assignedInstances,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch hosting node';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { parseAndNormalizeEndpoint } from '../route';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    await connectToDatabase();

    const body = await req.json();
    const node = await HostingNode.findById(id);
    if (!node) {
      return NextResponse.json({ error: 'Hosting node not found' }, { status: 404 });
    }

    if (body.isDefault && !node.isDefault) {
      await HostingNode.updateMany({ _id: { $ne: node._id } }, { isDefault: false });
    }

    if (body.name !== undefined) node.name = body.name.trim();
    if (body.region !== undefined) node.region = body.region.trim();
    if (body.dbUrl !== undefined) {
      const dbEndpoint = parseAndNormalizeEndpoint(body.dbUrl, body.port ? Number(body.port) : node.port);
      node.dbUrl = dbEndpoint.host;
      if (body.port === undefined && dbEndpoint.port !== 27017) {
        node.port = dbEndpoint.port;
      }
    }
    if (body.port !== undefined) node.port = Number(body.port);
    if (body.protocol !== undefined) node.protocol = body.protocol === 'http' ? 'http' : 'https';
    if (body.httpPort !== undefined) node.httpPort = Number(body.httpPort);
    if (body.grpcUrl !== undefined) {
      const grpcEndpoint = parseAndNormalizeEndpoint(body.grpcUrl, body.grpcPort ? Number(body.grpcPort) : node.grpcPort);
      node.grpcUrl = grpcEndpoint.host;
      if (body.grpcPort === undefined && grpcEndpoint.port !== 50051) {
        node.grpcPort = grpcEndpoint.port;
      }
    }
    if (body.grpcPort !== undefined) node.grpcPort = Number(body.grpcPort);
    if (body.defaultRootUsername !== undefined) node.defaultRootUsername = body.defaultRootUsername.trim();
    if (body.defaultRootPassword !== undefined) node.defaultRootPassword = body.defaultRootPassword.trim();
    if (body.status !== undefined) node.status = body.status;
    if (body.maxCapacity !== undefined) node.maxCapacity = Number(body.maxCapacity);
    if (body.notes !== undefined) node.notes = body.notes;
    if (body.isDefault !== undefined) node.isDefault = Boolean(body.isDefault);

    await node.save();

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_UPDATED' as any,
      entityType: 'HostingNode',
      entityId: node._id.toString(),
      metadata: { name: node.name, status: node.status },
    });

    return NextResponse.json({ success: true, node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update hosting node';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
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

    const assignedCount = await ManagedDatabase.countDocuments({
      hostingNodeId: node._id,
      status: { $nin: ['TERMINATED', 'DELETED'] },
    });

    if (assignedCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete hosting node: ${assignedCount} active database instance(s) are currently running on this node. Drain or migrate instances first.`,
        },
        { status: 400 }
      );
    }

    await HostingNode.findByIdAndDelete(id);

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_DELETED' as any,
      entityType: 'HostingNode',
      entityId: id,
      metadata: { name: node.name },
    });

    return NextResponse.json({ success: true, message: 'Hosting node deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete hosting node';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
