import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { PatchTenantInputSchema } from '@/lib/liorandb-admin/tenant-types';
import { adminSharedTenantAction, getSharedHostingContext } from '@/lib/services/shared-hosting.service';

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    await requireAdminAPI();
    const { tenantId } = await params;
    const { client } = await getSharedHostingContext();
    return NextResponse.json({ tenant: await client.getSharedTenant(tenantId) });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const admin = await requireAdminAPI();
    const { tenantId } = await params;
    const parsed = PatchTenantInputSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid quota.' }, { status: 400 });
    const tenant = await adminSharedTenantAction(admin.userId, tenantId, 'quota', parsed.data.storage_quota_bytes);
    return NextResponse.json({ tenant });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const admin = await requireAdminAPI();
    const { tenantId } = await params;
    const result = await adminSharedTenantAction(admin.userId, tenantId, 'delete');
    return NextResponse.json({ result });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
