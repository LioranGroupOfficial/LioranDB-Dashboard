import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { encrypt } from '@/lib/crypto';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import type { HostingAllocationMode, HostingNodeHealthStatus, HostingNodeStatus } from '@/lib/db/models/HostingNode';

export async function GET(_req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const nodes = await HostingNode.find().sort({ createdAt: -1 }).lean();

    // Reconcile current assigned server 1:1 allocation dynamically
    const enrichedNodes = await Promise.all(
      nodes.map(async (node) => {
        const activeInstance = await ManagedDatabase.findOne({
          hostingNodeId: node._id,
          status: { $nin: ['TERMINATED', 'DELETED'] },
        })
          .select('name status _id')
          .lean();

        return {
          ...node,
          maxCapacity: 1,
          currentAssignedCount: activeInstance ? 1 : 0,
          assignedInstanceName: activeInstance?.name || undefined,
          assignedInstanceStatus: activeInstance?.status || undefined,
          assignedDatabaseId: activeInstance?._id?.toString() || undefined,
        };
      })
    );

    return NextResponse.json({ success: true, nodes: enrichedNodes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch hosting nodes';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export function parseAndNormalizeEndpoint(
  input: string,
  fallbackPort?: number
): { host: string; port: number } {
  let cleaned = (input || '').trim();

  // Strip leading protocols
  cleaned = cleaned.replace(/^(https?:\/\/|grpc:\/\/|liorandb(\+(https?))?:\/\/|mongodb:\/\/)/i, '');
  // Strip trailing paths / query parameters
  cleaned = cleaned.split('/')[0].split('?')[0];

  let port = fallbackPort || 27018;

  // Check if contains :port (e.g. 127.0.0.1:27018 or localhost:50051)
  if (cleaned.includes(':') && !cleaned.startsWith('[')) {
    const parts = cleaned.split(':');
    cleaned = parts[0];
    const parsedPort = parseInt(parts[1], 10);
    if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
    }
  }

  return { host: cleaned, port };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminAPI();
    await connectToDatabase();

    const body = await req.json();
    const {
      name,
      slug,
      region,
      dbUrl,
      port,
      protocol,
      httpPort,
      grpcUrl,
      grpcPort,
      controlPlaneEndpoint,
      controlPlaneToken,
      allocationMode,
      defaultRootUsername,
      notes,
      isDefault,
    } = body;

    if (!name || !dbUrl || !grpcUrl) {
      return NextResponse.json(
        { error: 'Node Name, DB URL (Host), and gRPC URL are required.' },
        { status: 400 }
      );
    }

    const nodeSlug = (slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');

    const existing = await HostingNode.findOne({ slug: nodeSlug });
    if (existing) {
      return NextResponse.json(
        { error: `Hosting node with slug "${nodeSlug}" already exists. Please choose a distinct name.` },
        { status: 409 }
      );
    }

    // Parse and normalize host and port for DB & gRPC
    const dbEndpoint = parseAndNormalizeEndpoint(dbUrl, Number(port) || 27018);
    const grpcEndpoint = parseAndNormalizeEndpoint(grpcUrl, Number(grpcPort) || 27019);

    const normalizedProtocol = protocol === 'https' ? 'https' : 'http';
    const normalizedHttpPort = Number(httpPort) || (normalizedProtocol === 'https' ? 443 : 27018);
    const normalizedControlPlaneEndpoint =
      (controlPlaneEndpoint || '').trim() ||
      `${normalizedProtocol}://${dbEndpoint.host}:${normalizedHttpPort}`;

    // Encrypt custom control plane token if supplied
    const encryptedToken = controlPlaneToken && controlPlaneToken.trim().length >= 32
      ? encrypt(controlPlaneToken.trim())
      : undefined;

    // Test live connection to the Rust control plane
    let healthStatus: HostingNodeHealthStatus = 'UNKNOWN';
    let serverIdentity: string | undefined;
    let serverVersion = '2.4.1';
    let initialStatus: HostingNodeStatus = 'AVAILABLE';

    const testClient = new LioranDBAdminClient({
      endpoint: normalizedControlPlaneEndpoint,
      controlPlaneToken: controlPlaneToken?.trim() || process.env.LIORANDB_CONTROL_PLANE_TOKEN,
      timeoutMs: 5000,
    });

    try {
      const statusRes = await testClient.getServerStatus();
      healthStatus = statusRes.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED';
      serverIdentity = statusRes.instanceId;
      serverVersion = statusRes.version || '2.4.1';
      initialStatus = statusRes.status === 'HEALTHY' ? 'AVAILABLE' : 'FAILED';
    } catch (err: unknown) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('authentication') || errMsg.includes('unauthorized')) {
        healthStatus = 'AUTHENTICATION_FAILED';
      } else {
        healthStatus = 'UNREACHABLE';
      }
      initialStatus = 'FAILED';
    }

    // If marked default, unset other defaults
    if (isDefault) {
      await HostingNode.updateMany({}, { isDefault: false });
    }

    const node = await HostingNode.create({
      name: name.trim(),
      slug: nodeSlug,
      region: region || 'Asia (Mumbai)',
      dbUrl: dbEndpoint.host,
      port: Number(port) || dbEndpoint.port,
      protocol: normalizedProtocol,
      httpPort: normalizedHttpPort,
      grpcUrl: grpcEndpoint.host,
      grpcPort: Number(grpcPort) || grpcEndpoint.port,
      controlPlaneEndpoint: normalizedControlPlaneEndpoint,
      encryptedControlPlaneToken: encryptedToken,
      serverIdentity,
      serverVersion,
      healthStatus,
      allocationMode: (allocationMode as HostingAllocationMode) || 'DEDICATED',
      status: initialStatus,
      maxCapacity: 1,
      currentAssignedCount: 0,
      lastHealthCheckAt: new Date(),
      defaultRootUsername: (defaultRootUsername || 'admin').trim(),
      notes: notes || '',
      isDefault: Boolean(isDefault),
    });

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_CREATED' as any,
      entityType: 'HostingNode',
      entityId: node._id.toString(),
      metadata: {
        name: node.name,
        dbUrl: node.dbUrl,
        grpcUrl: node.grpcUrl,
        healthStatus: node.healthStatus,
        serverIdentity: node.serverIdentity,
      },
    });

    return NextResponse.json({
      success: true,
      node,
      handshake: {
        healthStatus,
        serverIdentity,
        serverVersion,
        verified: healthStatus === 'HEALTHY',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create hosting node';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
