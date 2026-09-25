import {
  getNextBillingDate,
  getBillingStatus,
  formatCurrency,
  calculateInstanceDeletionRefund,
} from '@/lib/billing';

describe('Billing Module', () => {
  test('getNextBillingDate always returns 1st of next month in IST', () => {
    const ref = new Date('2026-03-15T12:00:00Z');
    const next = getNextBillingDate(ref);
    const istMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      month: '2-digit',
      day: '2-digit',
    }).format(next);

    expect(istMonth).toContain('04-01');
  });

  test('formatCurrency formats Indian Rupee correctly', () => {
    const formatted = formatCurrency(5000, 'INR');
    expect(formatted).toContain('5,000');
  });

  test('getBillingStatus correctly detects states', () => {
    expect(getBillingStatus({ subscriptionStatus: 'SUSPENDED' })).toBe('SUSPENDED');
    expect(getBillingStatus({ subscriptionStatus: 'CANCELLED' })).toBe('CANCELLED');
    expect(getBillingStatus({ subscriptionStatus: 'PAST_DUE' })).toBe('PAST_DUE');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    expect(
      getBillingStatus({
        subscriptionStatus: 'ACTIVE',
        nextPaymentDate: futureDate,
      })
    ).toBe('ACTIVE');

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    expect(
      getBillingStatus({
        subscriptionStatus: 'ACTIVE',
        nextPaymentDate: pastDate,
      })
    ).toBe('DUE');
  });

  describe('Instance Deletion Tiered Refund Policy', () => {
    const basePaise = 149900; // ₹1,499.00
    const now = new Date('2026-09-25T12:00:00.000Z');

    test('refunds 100% when deleted under 15 minutes', () => {
      // 5 minutes after creation
      const created5m = new Date(now.getTime() - 5 * 60 * 1000);
      const quote5m = calculateInstanceDeletionRefund(created5m, basePaise, now);
      expect(quote5m.refundPercentage).toBe(100);
      expect(quote5m.refundAmountPaise).toBe(149900);
      expect(quote5m.refundAmountRupees).toBe(1499);
      expect(quote5m.tierLabel).toContain('100%');

      // Exactly 15 minutes after creation
      const created15m = new Date(now.getTime() - 15 * 60 * 1000);
      const quote15m = calculateInstanceDeletionRefund(created15m, basePaise, now);
      expect(quote15m.refundPercentage).toBe(100);
      expect(quote15m.refundAmountPaise).toBe(149900);
    });

    test('refunds 90% when deleted under 1 hour (between 15 and 60 minutes)', () => {
      // 16 minutes after creation
      const created16m = new Date(now.getTime() - 16 * 60 * 1000);
      const quote16m = calculateInstanceDeletionRefund(created16m, basePaise, now);
      expect(quote16m.refundPercentage).toBe(90);
      expect(quote16m.refundAmountPaise).toBe(134910);
      expect(quote16m.refundAmountRupees).toBe(1349.1);
      expect(quote16m.tierLabel).toContain('90%');

      // 45 minutes after creation
      const created45m = new Date(now.getTime() - 45 * 60 * 1000);
      const quote45m = calculateInstanceDeletionRefund(created45m, basePaise, now);
      expect(quote45m.refundPercentage).toBe(90);
      expect(quote45m.refundAmountPaise).toBe(134910);

      // Exactly 60 minutes after creation
      const created60m = new Date(now.getTime() - 60 * 60 * 1000);
      const quote60m = calculateInstanceDeletionRefund(created60m, basePaise, now);
      expect(quote60m.refundPercentage).toBe(90);
      expect(quote60m.refundAmountPaise).toBe(134910);
    });

    test('refunds 60% when deleted between 1 hour and 3 hours (60 to 180 minutes)', () => {
      // 61 minutes after creation
      const created61m = new Date(now.getTime() - 61 * 60 * 1000);
      const quote61m = calculateInstanceDeletionRefund(created61m, basePaise, now);
      expect(quote61m.refundPercentage).toBe(60);
      expect(quote61m.refundAmountPaise).toBe(89940);
      expect(quote61m.refundAmountRupees).toBe(899.4);
      expect(quote61m.tierLabel).toContain('60%');

      // 2 hours (120 minutes) after creation
      const created2h = new Date(now.getTime() - 120 * 60 * 1000);
      const quote2h = calculateInstanceDeletionRefund(created2h, basePaise, now);
      expect(quote2h.refundPercentage).toBe(60);
      expect(quote2h.refundAmountPaise).toBe(89940);

      // Exactly 3 hours (180 minutes) after creation
      const created3h = new Date(now.getTime() - 180 * 60 * 1000);
      const quote3h = calculateInstanceDeletionRefund(created3h, basePaise, now);
      expect(quote3h.refundPercentage).toBe(60);
      expect(quote3h.refundAmountPaise).toBe(89940);
    });

    test('refunds 0% (no refund) when deleted after 3 hours (> 180 minutes)', () => {
      // 181 minutes (3 hours 1 min) after creation
      const created181m = new Date(now.getTime() - 181 * 60 * 1000);
      const quote181m = calculateInstanceDeletionRefund(created181m, basePaise, now);
      expect(quote181m.refundPercentage).toBe(0);
      expect(quote181m.refundAmountPaise).toBe(0);
      expect(quote181m.refundAmountRupees).toBe(0);
      expect(quote181m.tierLabel).toContain('No refund');

      // 24 hours after creation
      const created24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const quote24h = calculateInstanceDeletionRefund(created24h, basePaise, now);
      expect(quote24h.refundPercentage).toBe(0);
      expect(quote24h.refundAmountPaise).toBe(0);
      expect(quote24h.refundAmountRupees).toBe(0);
    });
  });
});

