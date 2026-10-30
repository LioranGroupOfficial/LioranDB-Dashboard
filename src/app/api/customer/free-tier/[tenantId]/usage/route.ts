import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { getOwnedSharedTenant } from '@/lib/services/shared-hosting.service';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const { tenantId } = await params;
    const result = await getOwnedSharedTenant(user.userId, tenantId, true);
    return NextResponse.json({ usage: result.usage, measuredAt: new Date().toISOString() });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
