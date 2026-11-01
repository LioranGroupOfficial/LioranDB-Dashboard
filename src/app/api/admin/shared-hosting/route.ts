import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, User } from '@/lib/db';
import { createApiError } from '@/lib/errors';
import { CreateTenantInputSchema } from '@/lib/liorandb-admin/tenant-types';
import { getSharedHostingSnapshot, listSharedTenants, provisionFreeSharedTenant } from '@/lib/services/shared-hosting.service';

export async function GET() {
  try {
    await requireAdminAPI();
    const [snapshot, tenants] = await Promise.all([getSharedHostingSnapshot(), listSharedTenants()]);
    await connectToDatabase();
    const owners = await User.find({ _id: { $in: tenants.map((tenant) => tenant.external_owner_id) } })
      .select('email profile.fullName')
      .lean();
    const ownerById = new Map(owners.map((owner) => [owner._id.toString(), owner]));

    return NextResponse.json({
      snapshot,
      tenants: tenants.map((tenant) => ({
        ...tenant,
        customer: ownerById.get(tenant.external_owner_id)
          ? {
              id: ownerById.get(tenant.external_owner_id)!._id.toString(),
              email: ownerById.get(tenant.external_owner_id)!.email,
              fullName: ownerById.get(tenant.external_owner_id)!.profile?.fullName,
            }
          : null,
      })),
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminAPI();
    const body = await req.json();
    const parsed = CreateTenantInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid tenant request.' }, { status: 400 });
    }
    await connectToDatabase();
    const owner = await User.findById(parsed.data.external_owner_id).select('_id').lean();
    if (!owner) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
    const result = await provisionFreeSharedTenant({
      ownerId: parsed.data.external_owner_id,
      idempotencyKey: req.headers.get('idempotency-key') || undefined,
    });
    return NextResponse.json({ success: true, tenant: result.tenant, credentials: result.credentials }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SHARED_HOSTING_CAPACITY_EXHAUSTED') {
      return NextResponse.json({ error: 'No free shared database slots are currently available.', code: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'FREE_TIER_ALREADY_ALLOCATED') {
      return NextResponse.json({ error: 'Each customer may have at most one free shared database.', code: error.message }, { status: 409 });
    }
    return createApiError(error);
  }
}
