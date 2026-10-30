import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { rotateOwnedSharedTenantCredentials } from '@/lib/services/shared-hosting.service';

export async function POST(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const { tenantId } = await params;
    const credentials = await rotateOwnedSharedTenantCredentials(user.userId, tenantId);
    return NextResponse.json({ success: true, credentials });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
