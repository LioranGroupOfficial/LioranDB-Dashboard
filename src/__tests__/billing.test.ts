import {
  getNextBillingDate,
  getBillingStatus,
  formatCurrency,
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
});

