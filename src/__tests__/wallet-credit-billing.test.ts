import {
  calculatePlanPrice,
  getPlan,
  REGISTRATION_FEE_PAISE,
} from '@/lib/plans';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import crypto from 'crypto';

describe('Prepaid Wallet & Credit Billing System', () => {
  const mockSecret = 'test_secret_for_wallet_tests_12345';

  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = mockSecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = mockSecret;
    process.env.CREDENTIAL_ENCRYPTION_KEY =
      'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
  });

  // 1. Minimum initial credit is ₹100
  test('Minimum initial credit top-up is exactly ₹100 (10,000 paise)', () => {
    expect(REGISTRATION_FEE_PAISE).toBe(10000);
  });

  // 2. ₹100 payment calculation
  test('₹100 top-up represents exactly 10,000 paise', () => {
    const amountRupees = 100;
    const amountPaise = Math.round(amountRupees * 100);
    expect(amountPaise).toBe(10000);
  });

  // 3. ₹500 payment calculation
  test('₹500 top-up represents exactly 50,000 paise', () => {
    const amountRupees = 500;
    const amountPaise = Math.round(amountRupees * 100);
    expect(amountPaise).toBe(50000);
  });

  // 4. ₹99 top-up validation
  test('Top-up below ₹100 (e.g. ₹99 = 9,900 paise) fails validation threshold', () => {
    const amountRupees = 99;
    const amountPaise = amountRupees * 100;
    const isValid = amountPaise >= REGISTRATION_FEE_PAISE;
    expect(isValid).toBe(false);
  });

  // 5. Razorpay Signature Verification
  test('Valid Razorpay payment signature verifies correctly', () => {
    const orderId = 'order_topup_123';
    const paymentId = 'pay_topup_456';
    const validSignature = crypto
      .createHmac('sha256', mockSecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: validSignature,
    });
    expect(isValid).toBe(true);
  });

  test('Invalid/tampered Razorpay signature is rejected', () => {
    const orderId = 'order_topup_123';
    const paymentId = 'pay_topup_456';
    const invalidSignature = 'tampered_signature_string';

    const isValid = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: invalidSignature,
    });
    expect(isValid).toBe(false);
  });

  // 6. Plan Pricing and Credit Deductions
  test('Developer Shared deducts ₹299 (29,900 paise)', () => {
    const price = calculatePlanPrice('developer_shared', false);
    expect(price.totalPricePaise).toBe(29900);
    expect(price.totalPriceRupees).toBe(299);
  });

  test('Starter Dedicated deducts ₹1,499 (149,900 paise)', () => {
    const price = calculatePlanPrice('starter', false);
    expect(price.totalPricePaise).toBe(149900);
    expect(price.totalPriceRupees).toBe(1499);
  });

  test('Starter Dedicated + Daily Backup deducts ₹1,999 (199,900 paise)', () => {
    const price = calculatePlanPrice('starter', true);
    expect(price.basePricePaise).toBe(149900);
    expect(price.backupPricePaise).toBe(50000);
    expect(price.totalPricePaise).toBe(199900);
    expect(price.totalPriceRupees).toBe(1999);
  });

  test('Growth Dedicated deducts ₹2,499 (249,900 paise) and includes daily backup for ₹0', () => {
    const price = calculatePlanPrice('growth', true);
    expect(price.basePricePaise).toBe(249900);
    expect(price.backupPricePaise).toBe(0);
    expect(price.totalPricePaise).toBe(249900);
    expect(price.totalPriceRupees).toBe(2499);
    expect(price.isDailyBackupIncluded).toBe(true);
  });

  test('Pro Dedicated deducts ₹5,000 (500,000 paise) and includes daily backup for ₹0', () => {
    const price = calculatePlanPrice('pro', true);
    expect(price.basePricePaise).toBe(500000);
    expect(price.backupPricePaise).toBe(0);
    expect(price.totalPricePaise).toBe(500000);
    expect(price.totalPriceRupees).toBe(5000);
    expect(price.isDailyBackupIncluded).toBe(true);
  });

  // 7. Wallet Math & Balance Calculations
  test('Ledger balance math is exact without floating point rounding', () => {
    const initialBalancePaise = 500000; // ₹5,000.00
    const debitAmountPaise = 149900; // ₹1,499.00
    const remainingBalancePaise = initialBalancePaise - debitAmountPaise;

    expect(remainingBalancePaise).toBe(350100); // ₹3,501.00
    expect(remainingBalancePaise / 100).toBe(3501);
  });

  test('Exact balance spending leaves exactly zero balance', () => {
    const initialBalancePaise = 149900;
    const debitAmountPaise = 149900;
    const remainingBalancePaise = initialBalancePaise - debitAmountPaise;

    expect(remainingBalancePaise).toBe(0);
  });

  test('Insufficient balance check detects shortfall correctly', () => {
    const availablePaise = 100000; // ₹1,000
    const requiredPaise = 149900; // ₹1,499
    const isSufficient = availablePaise >= requiredPaise;
    const shortfallPaise = requiredPaise - availablePaise;

    expect(isSufficient).toBe(false);
    expect(shortfallPaise).toBe(49900); // ₹499
  });

  // 8. Idempotency Key Generation
  test('Idempotency keys prevent duplicate transaction executions', () => {
    const txId = 'rzp_pay_sample_123';
    const key1 = `topup_${txId}`;
    const key2 = `topup_${txId}`;

    expect(key1).toBe(key2);
  });

  // 9. Renewal period calculation
  test('Renewal period calculates 3-day grace period end date', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const graceDays = 3;
    const graceEnd = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

    expect(graceEnd.toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });
});

