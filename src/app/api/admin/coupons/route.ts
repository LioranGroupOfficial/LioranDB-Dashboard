import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, Coupon } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(_req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, coupons });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch coupons';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminAPI();
    const body = await req.json();
    const {
      code,
      discountPercentage,
      scope,
      planIds,
      customerId,
      instanceId,
      expiresAt,
      maxRedemptions,
    } = body;

    const normalizedCode = (code || '').trim().toUpperCase();
    if (!normalizedCode || !/^[A-Z0-9_-]{2,30}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: 'Coupon code must be 2-30 uppercase alphanumeric characters or dashes/underscores' },
        { status: 400 }
      );
    }

    const discount = parseInt(discountPercentage, 10);
    if (isNaN(discount) || discount < 1 || discount > 100) {
      return NextResponse.json(
        { error: 'Discount percentage must be an integer between 1 and 100' },
        { status: 400 }
      );
    }

    const validScopes = ['ALL', 'PLAN', 'CUSTOMER', 'INSTANCE'];
    const couponScope = (scope || 'ALL').toUpperCase();
    if (!validScopes.includes(couponScope)) {
      return NextResponse.json(
        { error: 'Scope must be one of: ALL, PLAN, CUSTOMER, INSTANCE' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return NextResponse.json(
        { error: `Coupon with code "${normalizedCode}" already exists` },
        { status: 400 }
      );
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      discountPercentage: discount,
      enabled: true,
      scope: couponScope,
      planIds: Array.isArray(planIds) ? planIds : undefined,
      customerId: customerId || undefined,
      instanceId: instanceId || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : undefined,
      redemptionCount: 0,
      createdBy: admin.userId,
    });

    await createAuditLog({
      userId: admin.userId,
      action: 'COUPON_CREATED',
      entityType: 'COUPON',
      entityId: coupon._id.toString(),
      metadata: { code: normalizedCode, discountPercentage: discount, scope: couponScope },
    });

    return NextResponse.json({ success: true, coupon });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create coupon';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
