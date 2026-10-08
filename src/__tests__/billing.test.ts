import {
  calculateInstanceUsage,
  getCurrentMonthPeriod,
  getPreviousMonthPeriod,
} from '@/lib/billing';
import type { IManagedDatabase } from '@/lib/db';
import mongoose from 'mongoose';

describe('LioranDB Postpaid Usage-Based Billing Engine', () => {
  test('getCurrentMonthPeriod returns start and end dates', () => {
    const period = getCurrentMonthPeriod();
    expect(period.start).toBeInstanceOf(Date);
    expect(period.end).toBeInstanceOf(Date);
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
  });

  test('getPreviousMonthPeriod returns start and end dates', () => {
    const period = getPreviousMonthPeriod();
    expect(period.start).toBeInstanceOf(Date);
    expect(period.end).toBeInstanceOf(Date);
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
  });

  test('calculateInstanceUsage calculates integer paise accurately without float drift', async () => {
    const period = {
      start: new Date('2026-04-01T00:00:00.000Z'),
      end: new Date('2026-05-01T00:00:00.000Z'),
    };
    const now = new Date('2026-05-02T00:00:00.000Z');

    const mockInstance = {
      _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
      name: 'prod-shared-db',
      hourlyRatePaise: 100, // ₹1/hr
      backupEnabled: true,
      backupMonthlyPaise: 20000, // ₹200/mo
      billingStartedAt: new Date('2026-04-01T00:00:00.000Z'),
      billingStoppedAt: undefined,
      status: 'ACTIVE' as const,
    } as unknown as IManagedDatabase;

    const usage = await calculateInstanceUsage(mockInstance, period, now);

    // 30 days in April = 720 hours = 2,592,000 seconds
    expect(usage.billableHours).toBe(720);
    expect(usage.usageAmountPaise).toBe(72000); // ₹720.00
    expect(usage.backupAmountPaise).toBe(20000); // ₹200.00
    expect(usage.totalPaise).toBe(92000); // ₹920.00
  });

  test('calculateInstanceUsage handles partial hours down to second precision', async () => {
    const period = {
      start: new Date('2026-04-01T00:00:00.000Z'),
      end: new Date('2026-04-02T00:00:00.000Z'),
    };
    const now = new Date('2026-04-02T00:00:00.000Z');

    const mockInstance = {
      _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d2'),
      name: 'test-db-short',
      hourlyRatePaise: 800, // ₹8/hr for Dedicated
      backupEnabled: false,
      backupMonthlyPaise: 0,
      billingStartedAt: new Date('2026-04-01T00:00:00.000Z'),
      billingStoppedAt: new Date('2026-04-01T12:30:00.000Z'), // 12.5 hours
      status: 'TERMINATED' as const,
    } as unknown as IManagedDatabase;

    const usage = await calculateInstanceUsage(mockInstance, period, now);

    expect(usage.billableHours).toBeCloseTo(12.5, 1);
    expect(usage.usageAmountPaise).toBe(10000); // 12.5 * 800 paise = 10,000 paise (₹100)
    expect(usage.backupAmountPaise).toBe(0);
    expect(usage.totalPaise).toBe(10000);
  });

  test('calculateInstanceUsage does not bill un-started instances', async () => {
    const period = {
      start: new Date('2026-04-01T00:00:00.000Z'),
      end: new Date('2026-05-01T00:00:00.000Z'),
    };
    const now = new Date('2026-05-02T00:00:00.000Z');

    const mockUnstarted = {
      _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d3'),
      name: 'provisioning-db',
      hourlyRatePaise: 100,
      backupEnabled: false,
      status: 'PROVISIONING' as const,
      billingStartedAt: undefined,
    } as unknown as IManagedDatabase;

    const usage = await calculateInstanceUsage(mockUnstarted, period, now);
    expect(usage.billableSeconds).toBe(0);
    expect(usage.totalPaise).toBe(0);
  });

  test('calculateInstanceUsage applies coupon discount percentage correctly', async () => {
    const period = {
      start: new Date('2026-04-01T00:00:00.000Z'),
      end: new Date('2026-05-01T00:00:00.000Z'),
    };
    const now = new Date('2026-05-02T00:00:00.000Z');

    const mockDiscounted = {
      _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d4'),
      name: 'discounted-db',
      hourlyRatePaise: 200, // ₹2/hr
      backupEnabled: false,
      couponCode: 'LAUNCH50',
      couponDiscountPercentage: 50,
      billingStartedAt: new Date('2026-04-01T00:00:00.000Z'),
      status: 'ACTIVE' as const,
    } as unknown as IManagedDatabase;

    const usage = await calculateInstanceUsage(mockDiscounted, period, now);
    // 720 hours * 200 paise = 144,000 paise (₹1,440.00)
    // 50% discount = 72,000 paise
    // Final total = 72,000 paise (₹720.00)
    expect(usage.subtotalPaise).toBe(144000);
    expect(usage.discountPaise).toBe(72000);
    expect(usage.totalPaise).toBe(72000);
  });

  test('calculateInstanceUsage correctly computes only unbilled incremental delta for partial period', async () => {
    // Suppose an invoice was generated from 10:00 to 14:00 (4 hours billed).
    // The next billing period starts at 14:00 and goes to 16:00 (2 hours unbilled).
    const unbilledPeriod = {
      start: new Date('2026-04-01T14:00:00.000Z'),
      end: new Date('2026-04-01T16:00:00.000Z'),
    };
    const now = new Date('2026-04-01T16:00:00.000Z');

    const mockRunningInstance = {
      _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d5'),
      name: 'incremental-db',
      hourlyRatePaise: 100, // ₹1/hr
      backupEnabled: false,
      billingStartedAt: new Date('2026-04-01T10:00:00.000Z'),
      status: 'ACTIVE' as const,
    } as unknown as IManagedDatabase;

    const usage = await calculateInstanceUsage(mockRunningInstance, unbilledPeriod, now);

    // Only 2 hours (14:00 to 16:00) should be billed, not the full 6 hours from 10:00
    expect(usage.billableHours).toBe(2);
    expect(usage.usageAmountPaise).toBe(200); // 2 * 100 paise = ₹2.00
    expect(usage.totalPaise).toBe(200);
  });
});
