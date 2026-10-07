import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { validateCoupon } from '@/lib/billing/coupons';

export async function POST(req: NextRequest) {
  try {
    const session = await requireUserAPI();
    const body = await req.json();
    const { code, planId, instanceId } = body;

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    const result = await validateCoupon({
      code,
      customerId: session.userId,
      planId,
      instanceId,
    });

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error || 'Invalid coupon code',
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discountPercentage: result.discountPercentage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Coupon validation failed';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
