import { validateCouponForInstance, validateCoupon } from '@/lib/billing/coupons';
import type { ICoupon } from '@/lib/db';
import { Types } from '@/lib/db/object-id';

const mockCouponDoc = {
  _id: new Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
  code: 'SAVE20',
  discountPercentage: 20,
  enabled: true,
  scope: 'ALL' as const,
  redemptionCount: 0,
  maxRedemptions: 100,
} as unknown as ICoupon;

jest.mock('@/lib/db', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(true),
  Coupon: {
    findOne: jest.fn().mockImplementation((query: { code: string }) => {
      if (query.code === 'SAVE20') return Promise.resolve(mockCouponDoc);
      return Promise.resolve(null);
    }),
  },
}));

describe('Promotional Coupon Validation Engine', () => {
  test('Validates percentage discounts between 1% and 100%', () => {
    const coupon10 = {
      code: 'PROMO10',
      discountPercentage: 10,
      enabled: true,
      scope: 'ALL' as const,
      redemptionCount: 5,
      maxRedemptions: 100,
    } as unknown as ICoupon;

    const res = validateCouponForInstance(coupon10, {});
    expect(res.valid).toBe(true);
    expect(res.discountPercentage).toBe(10);
  });

  test('Rejects disabled or expired coupons', () => {
    const disabledCoupon = {
      code: 'DISABLED20',
      discountPercentage: 20,
      enabled: false,
      scope: 'ALL' as const,
      redemptionCount: 0,
    } as unknown as ICoupon;
    expect(validateCouponForInstance(disabledCoupon, {}).valid).toBe(false);

    const expiredCoupon = {
      code: 'EXPIRED50',
      discountPercentage: 50,
      enabled: true,
      scope: 'ALL' as const,
      expiresAt: new Date('2020-01-01'),
      redemptionCount: 0,
    } as unknown as ICoupon;
    expect(validateCouponForInstance(expiredCoupon, {}).valid).toBe(false);
  });

  test('Enforces maxRedemptions limit', () => {
    const maxedCoupon = {
      code: 'MAXED100',
      discountPercentage: 100,
      enabled: true,
      scope: 'ALL' as const,
      maxRedemptions: 10,
      redemptionCount: 10,
    } as unknown as ICoupon;
    expect(validateCouponForInstance(maxedCoupon, {}).valid).toBe(false);
  });

  test('Validates plan scope restrictions', () => {
    const dedicatedOnlyCoupon = {
      code: 'DEDICATED50',
      discountPercentage: 50,
      enabled: true,
      scope: 'PLAN' as const,
      planIds: ['dedicated'],
      redemptionCount: 0,
    } as unknown as ICoupon;

    expect(
      validateCouponForInstance(dedicatedOnlyCoupon, { planId: 'dedicated' }).valid
    ).toBe(true);

    expect(
      validateCouponForInstance(dedicatedOnlyCoupon, { planId: 'shared' }).valid
    ).toBe(false);
  });

  test('Async validateCoupon resolves coupon from DB and checks validity', async () => {
    const validRes = await validateCoupon({ code: 'SAVE20' });
    expect(validRes.valid).toBe(true);
    expect(validRes.discountPercentage).toBe(20);

    const invalidRes = await validateCoupon({ code: 'NONEXISTENT' });
    expect(invalidRes.valid).toBe(false);
  });
});
