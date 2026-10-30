import { NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { adminSharedTenantAction } from '@/lib/services/shared-hosting.service';

const ACTIONS = new Set(['suspend', 'resume', 'reset', 'rotate']);

export async function POST(_req: Request, { params }: { params: Promise<{ tenantId: string; action: string }> }) {
  try {
    const admin = await requireAdminAPI();
    const { tenantId, action } = await params;
    if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Unsupported shared tenant action.' }, { status: 400 });
    const result = await adminSharedTenantAction(admin.userId, tenantId, action as 'suspend' | 'resume' | 'reset' | 'rotate');
    return NextResponse.json({ result });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
