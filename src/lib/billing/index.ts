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

export interface DeletionRefundQuote {
  elapsedMinutes: number;
  refundPercentage: number; // 100, 90, 60, or 0
  baseAmountPaise: number;
  refundAmountPaise: number;
  refundAmountRupees: number;
  tierLabel: string;
}

/**
 * Calculates instance deletion refund according to policy:
 * - Deletion within 15 minutes of creation: 100% refund
 * - Deletion within 1 hour (<= 60 mins) of creation: 90% refund
 * - Deletion between 1 hour and 3 hours (<= 180 mins) of creation: 60% refund
 * - Deletion after 3 hours (> 180 mins) of creation: 0% refund (No refund)
 */
export function calculateInstanceDeletionRefund(
  createdAt: Date | string | number,
  baseAmountPaise: number,
  nowDate: Date = new Date()
): DeletionRefundQuote {
  const createdTime = new Date(createdAt).getTime();
  const currentTime = nowDate.getTime();
  const elapsedMs = Math.max(0, currentTime - createdTime);
  const elapsedMinutes = elapsedMs / (1000 * 60);

  let refundPercentage: number;
  let tierLabel: string;

  if (elapsedMinutes <= 15) {
    refundPercentage = 100;
    tierLabel = 'Under 15 minutes (100% full refund)';
  } else if (elapsedMinutes <= 60) {
    refundPercentage = 90;
    tierLabel = 'Under 1 hour (90% refund)';
  } else if (elapsedMinutes <= 180) {
    refundPercentage = 60;
    tierLabel = '1 to 3 hours (60% refund)';
  } else {
    refundPercentage = 0;
    tierLabel = 'After 3 hours (No refund)';
  }

  const refundAmountPaise = Math.round(baseAmountPaise * (refundPercentage / 100));
  const refundAmountRupees = refundAmountPaise / 100;

  return {
    elapsedMinutes,
    refundPercentage,
    baseAmountPaise,
    refundAmountPaise,
    refundAmountRupees,
    tierLabel,
  };
}

