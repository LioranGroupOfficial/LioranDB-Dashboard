import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, Coupon, ICoupon } from '@/lib/db';
import CouponManagerClient, { AdminCouponItem } from './CouponManagerClient';

export const metadata = { title: 'Coupons — Admin' };

export default async function AdminCouponsPage() {
  await requireAdmin();
  await connectToDatabase();

  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean<ICoupon[]>();

  const formatted: AdminCouponItem[] = coupons.map((c) => ({
    _id: c._id.toString(),
    code: c.code,
    discountPercentage: c.discountPercentage,
    enabled: Boolean(c.enabled),
    scope: c.scope || 'ALL',
    planIds: c.planIds || [],
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    maxRedemptions: c.maxRedemptions || null,
    redemptionCount: c.redemptionCount || 0,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Coupon Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Create and manage promotional discount coupons for database instances and plans.
        </p>
      </div>

      <CouponManagerClient initialCoupons={formatted} />
    </div>
  );
}
