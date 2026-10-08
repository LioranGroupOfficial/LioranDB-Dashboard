import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { encrypt } from '@/lib/crypto';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { parseAndNormalizeEndpoint } from '../route';
import type { HostingAllocationMode, HostingNodeHealthStatus } from '@/lib/db/models/HostingNode';

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
    if (body.allocationMode !== undefined) node.allocationMode = (body.allocationMode as HostingAllocationMode) || 'DEDICATED';

    if (body.dbUrl !== undefined) {
      const dbEndpoint = parseAndNormalizeEndpoint(body.dbUrl, body.port ? Number(body.port) : node.port);
      node.dbUrl = dbEndpoint.host;
      if (body.port === undefined && dbEndpoint.port !== 27018) {
        node.port = dbEndpoint.port;
      }
    }
    if (body.port !== undefined) node.port = Number(body.port);
    if (body.protocol !== undefined) node.protocol = body.protocol === 'https' ? 'https' : 'http';
    if (body.httpPort !== undefined) node.httpPort = Number(body.httpPort);
    if (body.grpcUrl !== undefined) {
      const grpcEndpoint = parseAndNormalizeEndpoint(body.grpcUrl, body.grpcPort ? Number(body.grpcPort) : node.grpcPort);
      node.grpcUrl = grpcEndpoint.host;
      if (body.grpcPort === undefined && grpcEndpoint.port !== 27019) {
        node.grpcPort = grpcEndpoint.port;
      }
    }
    if (body.grpcPort !== undefined) node.grpcPort = Number(body.grpcPort);

    if (body.controlPlaneEndpoint !== undefined) {
      node.controlPlaneEndpoint = body.controlPlaneEndpoint.trim();
    }
    if (body.controlPlaneToken && body.controlPlaneToken.trim().length >= 32) {
      node.encryptedControlPlaneToken = encrypt(body.controlPlaneToken.trim());
    }

    if (body.defaultRootUsername !== undefined) node.defaultRootUsername = body.defaultRootUsername.trim();
    if (body.status !== undefined) node.status = body.status;
    node.maxCapacity = 1;
    if (body.notes !== undefined) node.notes = body.notes;
    if (body.isDefault !== undefined) node.isDefault = Boolean(body.isDefault);

    // Run live health check against Rust control plane
    try {
      const client = LioranDBAdminClient.forNode(node);
      const statusRes = await client.getServerStatus();
      node.healthStatus = statusRes.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';
      node.serverIdentity = statusRes.instanceId;
      node.serverVersion = statusRes.version || '2.4.1';
      node.lastHealthCheckAt = new Date();
    } catch (err: unknown) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('authentication') || errMsg.includes('unauthorized')) {
        node.healthStatus = 'AUTHENTICATION_FAILED';
      } else {
        node.healthStatus = 'UNREACHABLE';
      }
    }

    await node.save();

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_UPDATED' as any,
      entityType: 'HostingNode',
      entityId: node._id.toString(),
      metadata: { name: node.name, status: node.status, healthStatus: node.healthStatus },
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

    // Clean up any references in terminated/deleted instances
    await ManagedDatabase.updateMany(
      { hostingNodeId: node._id },
      { $unset: { hostingNodeId: 1 } }
    );

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
