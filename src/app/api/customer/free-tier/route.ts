import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { CreateTenantInputSchema } from '@/lib/liorandb-admin/tenant-types';
import { getSharedHostingSnapshot, listOwnedSharedTenants, provisionFreeSharedTenant } from '@/lib/services/shared-hosting.service';

export async function GET() {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const [snapshot, databases] = await Promise.all([
      getSharedHostingSnapshot(),
      listOwnedSharedTenants(user.userId, true),
    ]);

    return NextResponse.json({
      enabled: snapshot.status.enabled,
      availableSlots: snapshot.status.available_slots,
      maxTenants: snapshot.status.max_tenants,
      quotaBytes: snapshot.status.default_storage_quota_bytes,
      resources: snapshot.status.resources,
      hasAllocation: databases.length > 0,
      databases: databases.map(({ tenant, usage, database }) => ({
        tenantId: tenant.tenant_id,
        databaseName: tenant.database_name,
        status: tenant.status,
        usage,
        database,
      })),
      measuredAt: snapshot.measuredAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'SHARED_HOSTING_CAPACITY_EXHAUSTED') return NextResponse.json({ error: 'No free shared database slots are currently available.', code: message }, { status: 409 });
    return createApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const body = await req.json();
    const parsed = CreateTenantInputSchema.safeParse({
      ...body,
      external_owner_id: user.userId,
      plan: 'free',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid free-tier request.' }, { status: 400 });
    }

    const result = await provisionFreeSharedTenant({
      ownerId: user.userId,
      ownerEmail: user.email,
      databaseName: parsed.data.database_name,
      idempotencyKey: req.headers.get('idempotency-key') || undefined,
    });
    return NextResponse.json({
      success: true,
      tenantId: result.tenant.tenant_id,
      database: result.database,
      credentials: result.credentials,
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
