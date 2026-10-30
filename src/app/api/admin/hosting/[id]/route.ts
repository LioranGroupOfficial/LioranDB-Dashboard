import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { encrypt } from '@/lib/crypto';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import { parseAndNormalizeEndpoint } from '../route';
import { getHostingNodeAllocationSnapshot, getNodeMaxCapacity, normalizeHostingAllocationConfig } from '@/lib/hosting/allocation';
import type { HostingNodeHealthStatus } from '@/lib/db/models/HostingNode';

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
      status: { $in: ['PENDING', 'PROVISIONING', 'ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'RESETTING', 'DELETING'] },
    })
      .select('name status customerId planId createdAt')
      .lean();
    const snapshot = await getHostingNodeAllocationSnapshot(node as any);

    return NextResponse.json({
      success: true,
      node: {
        ...node,
        maxCapacity: getNodeMaxCapacity(node as any),
        currentAssignedCount: snapshot.currentAssignedCount,
        pendingReservations: snapshot.pendingReservations,
        availableCapacity: snapshot.availableCapacity,
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
    const allocationRevision = Number(node.allocationRevision || 0);
    const currentMode = node.allocationMode || 'DEDICATED';
    const allocationSnapshot = await getHostingNodeAllocationSnapshot(node as any);
    let allocationConfig: ReturnType<typeof normalizeHostingAllocationConfig>;
    try {
      allocationConfig = normalizeHostingAllocationConfig(
        body.allocationMode,
        body.maxCapacity,
        { existingMode: currentMode }
      );
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid hosting allocation configuration.' }, { status: 400 });
    }
    if (allocationConfig.allocationMode !== currentMode && (allocationSnapshot.currentAssignedCount > 0 || allocationSnapshot.pendingReservations > 0)) {
      return NextResponse.json({ error: 'Cannot change allocation mode while occupied or pending allocations exist. Drain the node first.' }, { status: 409 });
    }
    if (allocationConfig.maxCapacity < allocationSnapshot.currentAssignedCount) {
      return NextResponse.json({ error: `Maximum capacity cannot be reduced below the ${allocationSnapshot.currentAssignedCount} occupied allocation(s) and pending reservations.` }, { status: 409 });
    }

    if (body.isDefault && !node.isDefault) {
      await HostingNode.updateMany({ _id: { $ne: node._id } }, { isDefault: false });
    }

    if (body.name !== undefined) node.name = body.name.trim();
    if (body.region !== undefined) node.region = body.region.trim();
    node.allocationMode = allocationConfig.allocationMode;

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
    if (body.status !== undefined) {
      if (body.status === 'AVAILABLE') {
        const activeCount = await ManagedDatabase.countDocuments({
          hostingNodeId: node._id,
          status: { $nin: ['TERMINATED', 'DELETED'] },
        });
        if (activeCount > 0 || allocationSnapshot.currentAssignedCount > 0) {
          return NextResponse.json({ error: 'Cannot set node status to AVAILABLE while active databases are assigned.' }, { status: 400 });
        }
      }
      node.status = body.status;
      if (body.status !== 'QUARANTINED') {
        node.quarantineReason = undefined;
      }
    }
    node.maxCapacity = allocationConfig.maxCapacity;
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

    const updateFields: Record<string, unknown> = {
      name: node.name,
      region: node.region,
      dbUrl: node.dbUrl,
      port: node.port,
      protocol: node.protocol,
      httpPort: node.httpPort,
      grpcUrl: node.grpcUrl,
      grpcPort: node.grpcPort,
      controlPlaneEndpoint: node.controlPlaneEndpoint,
      encryptedControlPlaneToken: node.encryptedControlPlaneToken,
      defaultRootUsername: node.defaultRootUsername,
      notes: node.notes,
      isDefault: node.isDefault,
      status: node.status,
      healthStatus: node.healthStatus,
      serverIdentity: node.serverIdentity,
      serverVersion: node.serverVersion,
      lastHealthCheckAt: node.lastHealthCheckAt,
      quarantineReason: node.quarantineReason,
      allocationMode: allocationConfig.allocationMode,
      maxCapacity: allocationConfig.maxCapacity,
      ...(body.allocationMode !== undefined || body.maxCapacity !== undefined || node.capacityRemaining === undefined
        ? { capacityRemaining: Math.max(0, allocationConfig.maxCapacity - allocationSnapshot.currentAssignedCount) }
        : {}),
    };
    const updateResult = await HostingNode.updateOne(
      { _id: node._id, $or: [{ allocationRevision }, { allocationRevision: { $exists: false } }] },
      { $set: updateFields, $inc: { allocationRevision: 1 } }
    );
    if (updateResult.matchedCount !== 1) {
      return NextResponse.json({ error: 'Hosting node changed while it was being updated. Refresh and retry.' }, { status: 409 });
    }
    const savedNode = await HostingNode.findById(node._id).lean();

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_UPDATED' as any,
      entityType: 'HostingNode',
      entityId: node._id.toString(),
      metadata: { name: node.name, status: node.status, healthStatus: node.healthStatus },
    });

    return NextResponse.json({ success: true, node: savedNode });
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
      status: { $in: ['PENDING', 'PROVISIONING', 'ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'RESETTING', 'DELETING'] },
    });
    const allocationSnapshot = await getHostingNodeAllocationSnapshot(node as any);

    if (assignedCount > 0 || allocationSnapshot.pendingReservations > 0 || allocationSnapshot.currentAssignedCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete hosting node: ${allocationSnapshot.currentAssignedCount} occupied or pending allocation(s) remain. Drain or migrate tenants first.`,
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
