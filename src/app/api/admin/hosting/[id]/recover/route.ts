import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingNode } from '@/lib/db';
import { recoverSingleNode } from '@/lib/providers/recovery';

/**
 * Admin-only single hosting node recovery action.
 *
 * Checks Docker container state, starts container if stopped, waits for running,
 * verifies Rust control plane health, validates storage cleanliness, and brings
 * eligible nodes to AVAILABLE without risking customer data.
 */
export async function POST(
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

    const result = await recoverSingleNode(node, {
      adminUserId: admin.userId,
      adminEmail: admin.email,
      allowCleanVerification: true,
    });

    return NextResponse.json({
      success: true,
      recovery: result,
      message: result.message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Node recovery failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
