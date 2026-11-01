import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { getOwnedSharedTenant } from '@/lib/services/shared-hosting.service';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const { tenantId } = await params;
    const result = await getOwnedSharedTenant(user.userId, tenantId, true);
    if (!result.usage) {
      return NextResponse.json(
        { error: 'Storage usage is currently unavailable.', code: 'TENANT_USAGE_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { usage: result.usage, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' } },
    );
  } catch (error: unknown) {
    return createApiError(error);
  }
}
