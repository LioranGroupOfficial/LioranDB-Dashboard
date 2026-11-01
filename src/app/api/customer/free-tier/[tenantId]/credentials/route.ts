import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { createApiError } from '@/lib/errors';
import { rotateOwnedSharedTenantCredentials } from '@/lib/services/shared-hosting.service';

export async function POST(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
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

    const credentials = await rotateOwnedSharedTenantCredentials(user.userId, sharedTenantId);
    return NextResponse.json({ success: true, credentials });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
