import { connectToDatabase, Coupon, Types } from '../db';
import type { ICoupon, CouponScope } from '../db/models/Coupon';

export interface CouponValidationInput {
  code: string;
  customerId?: string | Types.ObjectId;
  planId?: string;
  instanceId?: string | Types.ObjectId;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountPercentage: number;
  coupon?: ICoupon;
  error?: string;
  reason?: string;
}

/**
 * Pure synchronous validation logic for a coupon object.
 */
export function validateCouponForInstance(
  coupon: {
    _id?: string | Types.ObjectId;
    code: string;
    discountPercentage: number;
    enabled: boolean;
    scope: CouponScope | string;
    planIds?: string[];
    customerId?: string | Types.ObjectId;
    instanceId?: string | Types.ObjectId;
    expiresAt?: Date | string | null;
    maxRedemptions?: number | null;
    redemptionCount: number;
  },
  input: {
    planId?: string;
    customerId?: string | Types.ObjectId;
    instanceId?: string | Types.ObjectId;
  }
): { valid: boolean; discountPercentage: number; reason?: string } {
  if (!coupon.enabled) {
    return { valid: false, discountPercentage: 0, reason: 'This coupon is disabled or inactive.' };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return { valid: false, discountPercentage: 0, reason: 'This coupon has expired.' };
  }

  if (
    typeof coupon.maxRedemptions === 'number' &&
    coupon.maxRedemptions > 0 &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return { valid: false, discountPercentage: 0, reason: 'This coupon has reached its redemption limit.' };
  }

  const scopeLower = coupon.scope.toLowerCase();

  if (scopeLower === 'plan') {
    if (!input.planId || !coupon.planIds || !coupon.planIds.includes(input.planId)) {
      return {
        valid: false,
        discountPercentage: 0,
        reason: `Coupon is not applicable to this plan (${input.planId || 'none'}).`,
      };
    }
  }

  if (scopeLower === 'customer') {
    const custIdStr = input.customerId ? input.customerId.toString() : '';
    const couponCustIdStr = coupon.customerId ? coupon.customerId.toString() : '';
    if (!custIdStr || custIdStr !== couponCustIdStr) {
      return {
        valid: false,
        discountPercentage: 0,
        reason: 'This coupon is not valid for your account.',
      };
    }
  }

  if (scopeLower === 'instance') {
    const instIdStr = input.instanceId ? input.instanceId.toString() : '';
    const couponInstIdStr = coupon.instanceId ? coupon.instanceId.toString() : '';
    if (!instIdStr || instIdStr !== couponInstIdStr) {
      return {
        valid: false,
        discountPercentage: 0,
        reason: 'This coupon is not valid for this specific instance.',
      };
    }
  }

  return {
    valid: true,
    discountPercentage: coupon.discountPercentage,
  };
}

export async function validateCoupon(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  const normalizedCode = (input.code || '').trim().toUpperCase();

  if (!normalizedCode) {
    return {
      valid: false,
      code: '',
      discountPercentage: 0,
      error: 'Coupon code is required.',
      reason: 'Coupon code is required.',
    };
  }

  await connectToDatabase();
  const coupon = await Coupon.findOne({ code: normalizedCode });

  if (!coupon) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercentage: 0,
      error: 'Invalid coupon code.',
      reason: 'Invalid coupon code.',
    };
  }

  const check = validateCouponForInstance(coupon, input);
  if (!check.valid) {
    return {
      valid: false,
      code: normalizedCode,
      discountPercentage: 0,
      error: check.reason,
      reason: check.reason,
    };
  }

  return {
    valid: true,
    code: normalizedCode,
    discountPercentage: coupon.discountPercentage,
    coupon,
  };
}

export async function incrementCouponRedemption(code: string): Promise<void> {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) return;

  await connectToDatabase();
  await Coupon.findOneAndUpdate(
    { code: normalizedCode },
    { $inc: { redemptionCount: 1 } }
  );
}
