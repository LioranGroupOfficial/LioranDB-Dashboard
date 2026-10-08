import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(_req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const nodes = await HostingNode.find().sort({ createdAt: -1 }).lean();

    // Reconcile current assigned count dynamically
    const enrichedNodes = await Promise.all(
      nodes.map(async (node) => {
        const count = await ManagedDatabase.countDocuments({
          hostingNodeId: node._id,
          status: { $nin: ['TERMINATED', 'DELETED'] },
        });
        return {
          ...node,
          currentAssignedCount: count,
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
      defaultRootUsername,
      defaultRootPassword,
      status,
      maxCapacity,
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

    // If marked default, unset other defaults
    if (isDefault) {
      await HostingNode.updateMany({}, { isDefault: false });
    }

    const node = await HostingNode.create({
      name: name.trim(),
      slug: nodeSlug,
      region: region || 'Asia (Mumbai)',
      dbUrl: dbUrl.trim(),
      port: Number(port) || 27017,
      protocol: protocol === 'http' ? 'http' : 'https',
      httpPort: Number(httpPort) || 443,
      grpcUrl: grpcUrl.trim(),
      grpcPort: Number(grpcPort) || 50051,
      defaultRootUsername: (defaultRootUsername || 'admin').trim(),
      defaultRootPassword: defaultRootPassword ? defaultRootPassword.trim() : undefined,
      status: status || 'ACTIVE',
      maxCapacity: Number(maxCapacity) || 50,
      notes: notes || '',
      isDefault: Boolean(isDefault),
    });

    await createAuditLog({
      userId: admin.userId,
      action: 'HOSTING_NODE_CREATED' as any,
      entityType: 'HostingNode',
      entityId: node._id.toString(),
      metadata: { name: node.name, dbUrl: node.dbUrl, grpcUrl: node.grpcUrl },
    });

    return NextResponse.json({ success: true, node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create hosting node';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
