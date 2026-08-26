/**
 * Centralized billing service.
 * All date calculations use Asia/Kolkata (IST) timezone.
 * Timestamps stored in UTC internally.
 *
 * INTEGRATION POINT: Replace manual payment handling with Stripe/Razorpay
 * when a payment gateway is configured.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get the next billing date (1st of next month in IST).
 */
export function getNextBillingDate(fromDate: Date = new Date()): Date {
  // Work in IST
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = istFormatter.formatToParts(fromDate);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);

  // Next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  // 1st of next month at midnight IST → UTC
  const istMidnight = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);
  return istMidnight;
}

/**
 * Get current billing period dates.
 */
export function getCurrentBillingPeriod(startedAt: Date): {
  periodStart: Date;
  periodEnd: Date;
  nextPaymentDate: Date;
} {
  const now = new Date();

  // Billing is always on the 1st of month in IST
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = istFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);

  const periodStart = new Date(
    `${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`
  );

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const periodEnd = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`
  );

  return {
    periodStart,
    periodEnd,
    nextPaymentDate: periodEnd,
  };
}

export type BillingStatus =
  | 'ACTIVE'
  | 'UPCOMING_PAYMENT'
  | 'DUE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

/**
 * Determine billing status from subscription data.
 */
export function getBillingStatus(params: {
  subscriptionStatus: string;
  nextPaymentDate?: Date;
  lastPaymentStatus?: string;
}): BillingStatus {
  const { subscriptionStatus, nextPaymentDate, lastPaymentStatus } = params;

  if (subscriptionStatus === 'CANCELLED') return 'CANCELLED';
  if (subscriptionStatus === 'SUSPENDED') return 'SUSPENDED';
  if (subscriptionStatus === 'PAST_DUE') return 'PAST_DUE';

  if (nextPaymentDate) {
    const now = new Date();
    const daysUntilDue = (nextPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilDue < 0) return 'DUE';
    if (daysUntilDue <= 7) return 'UPCOMING_PAYMENT';
  }

  if (lastPaymentStatus === 'PENDING') return 'UPCOMING_PAYMENT';

  return 'ACTIVE';
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateIST(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
