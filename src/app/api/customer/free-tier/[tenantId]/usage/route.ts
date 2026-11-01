import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { createApiError } from '@/lib/errors';
import { getOwnedSharedTenant } from '@/lib/services/shared-hosting.service';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const { tenantId: allocationId } = await params;
    await connectToDatabase();
    const allocation = await ManagedDatabase.findOne({
      _id: allocationId,
      planId: 'free',
      $or: [{ customerId: user.userId }, { userId: user.userId }],
    }).lean();
    if (!allocation) return NextResponse.json({ error: 'Shared allocation not found.' }, { status: 404 });

    const sharedTenantId = allocation.sharedTenantId || allocation.providerDeploymentId;
    if (!sharedTenantId) return NextResponse.json({ error: 'Shared allocation identity is unavailable.' }, { status: 409 });

    const result = await getOwnedSharedTenant(user.userId, sharedTenantId, true);
    if (!result.usage) {
      return NextResponse.json(
        { error: 'Storage usage is currently unavailable.', code: 'TENANT_USAGE_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const { tenant_id: _tenantId, ...safeUsage } = result.usage;
    return NextResponse.json(
      { usage: safeUsage, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' } },
    );
  } catch (error: unknown) {
    return createApiError(error);
  }
}
