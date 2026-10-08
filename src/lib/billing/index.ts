/**
 * Centralized Usage-Based Postpaid Billing Service
 *
 * Product model:
 * - Billing starts ONLY when an instance reaches ACTIVE state (billingStartedAt).
 * - Billing stops when the instance is terminated/stopped (billingStoppedAt).
 * - Prorated backups at ₹200/month (20,000 paise).
 * - Authoritative server-side integer paise calculation.
 * - All dates calculated relative to Asia/Kolkata (IST).
 */

import { connectToDatabase, ManagedDatabase, Invoice, User } from '../db';
import type { IManagedDatabase } from '../db/models/ManagedDatabase';
import type { IInvoice, IInvoiceLineItem } from '../db/models/Invoice';
import { BACKUP_MONTHLY_PAISE, formatPaiseToRupees, getPlan } from '../plans';
import mongoose from 'mongoose';

const IST_TIMEZONE = 'Asia/Kolkata';

export const MIN_INVOICE_AMOUNT_PAISE = 500; // Minimum ₹5 (500 paise) threshold for invoice generation
export const MIN_INVOICE_AMOUNT_RUPEES = 5;

export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * Returns the billing period for the current calendar month in IST.
 */
export function getCurrentMonthPeriod(referenceDate: Date = new Date()): BillingPeriod {
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = istFormatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);

  const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);

  return { start, end };
}

/**
 * Returns the billing period for the previous calendar month in IST.
 */
export function getPreviousMonthPeriod(referenceDate: Date = new Date()): BillingPeriod {
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = istFormatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const start = new Date(`${prevYear}-${String(prevMonth).padStart(2, '0')}-01T00:00:00+05:30`);
  const end = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);

  return { start, end };
}

export interface InstanceUsageCalculation {
  instanceId: string;
  instanceName: string;
  planId: string;
  planName: string;
  hourlyRatePaise: number;
  effectiveHourlyRatePaise: number;
  billableSeconds: number;
  billableHours: number;
  usageAmountPaise: number;
  backupEnabled: boolean;
  backupSeconds: number;
  backupAmountPaise: number;
  couponCode?: string;
  couponDiscountPercentage: number;
  discountPaise: number;
  subtotalPaise: number;
  totalPaise: number;
}

/**
 * Calculates deterministic billable usage for a single database instance in a given period.
 */
export function calculateInstanceUsage(
  instance: {
    _id: string | mongoose.Types.ObjectId;
    name: string;
    planId: string;
    planName?: string;
    status: string;
    hourlyRatePaise?: number;
    billingStartedAt?: Date | string | null;
    billingStoppedAt?: Date | string | null;
    backupEnabled?: boolean;
    backupMonthlyPaise?: number;
    backupStartedAt?: Date | string | null;
    backupStoppedAt?: Date | string | null;
    couponCode?: string;
    couponDiscountPercentage?: number;
  },
  period: BillingPeriod,
  now: Date = new Date()
): InstanceUsageCalculation {
  const plan = getPlan(instance.planId);
  const hourlyRatePaise =
    typeof instance.hourlyRatePaise === 'number'
      ? instance.hourlyRatePaise
      : plan?.hourlyRatePaise || 100;
  const planName = instance.planName || plan?.name || 'Shared';

  const effectiveDiscountPercentage = Math.min(
    100,
    Math.max(0, instance.couponDiscountPercentage || 0)
  );
  const effectiveHourlyRatePaise = Math.round(
    hourlyRatePaise * (1 - effectiveDiscountPercentage / 100)
  );

  // If billing has not started yet (e.g. still PROVISIONING or PENDING), usage is 0
  if (!instance.billingStartedAt) {
    return {
      instanceId: instance._id.toString(),
      instanceName: instance.name,
      planId: instance.planId,
      planName,
      hourlyRatePaise,
      effectiveHourlyRatePaise,
      billableSeconds: 0,
      billableHours: 0,
      usageAmountPaise: 0,
      backupEnabled: false,
      backupSeconds: 0,
      backupAmountPaise: 0,
      couponCode: instance.couponCode,
      couponDiscountPercentage: effectiveDiscountPercentage,
      discountPaise: 0,
      subtotalPaise: 0,
      totalPaise: 0,
    };
  }

  const billingStart = new Date(instance.billingStartedAt);
  const billingStop = instance.billingStoppedAt ? new Date(instance.billingStoppedAt) : undefined;

  // Window bounds
  const effectiveStart = new Date(Math.max(billingStart.getTime(), period.start.getTime()));
  const maxEndBound = Math.min(now.getTime(), period.end.getTime());
  const effectiveEnd = billingStop
    ? new Date(Math.min(billingStop.getTime(), period.end.getTime()))
    : new Date(maxEndBound);

  let billableSeconds = 0;
  if (effectiveEnd.getTime() > effectiveStart.getTime()) {
    billableSeconds = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 1000);
  }

  const billableHours = billableSeconds / 3600;
  const usageAmountPaise = Math.round((billableSeconds * hourlyRatePaise) / 3600);

  // Backup Calculation
  let backupSeconds = 0;
  let backupAmountPaise = 0;
  const hasBackup = !!instance.backupEnabled || !!instance.backupStartedAt;

  if (hasBackup && billableSeconds > 0) {
    const backupStart = instance.backupStartedAt
      ? new Date(instance.backupStartedAt)
      : billingStart;
    const backupStop = instance.backupStoppedAt
      ? new Date(instance.backupStoppedAt)
      : billingStop;

    const backupEffStart = new Date(
      Math.max(backupStart.getTime(), effectiveStart.getTime(), period.start.getTime())
    );
    const backupEffEnd = backupStop
      ? new Date(Math.min(backupStop.getTime(), effectiveEnd.getTime(), period.end.getTime()))
      : effectiveEnd;

    if (backupEffEnd.getTime() > backupEffStart.getTime()) {
      backupSeconds = Math.floor((backupEffEnd.getTime() - backupEffStart.getTime()) / 1000);
      const totalMonthSeconds = Math.max(
        1,
        Math.floor((period.end.getTime() - period.start.getTime()) / 1000)
      );
      backupAmountPaise = Math.round((backupSeconds / totalMonthSeconds) * BACKUP_MONTHLY_PAISE);
    }
  }

  const grossSubtotalPaise = usageAmountPaise + backupAmountPaise;
  const discountPaise = Math.round((grossSubtotalPaise * effectiveDiscountPercentage) / 100);
  const totalPaise = Math.max(0, grossSubtotalPaise - discountPaise);

  return {
    instanceId: instance._id.toString(),
    instanceName: instance.name,
    planId: instance.planId,
    planName,
    hourlyRatePaise,
    effectiveHourlyRatePaise,
    billableSeconds,
    billableHours,
    usageAmountPaise,
    backupEnabled: hasBackup,
    backupSeconds,
    backupAmountPaise,
    couponCode: instance.couponCode,
    couponDiscountPercentage: effectiveDiscountPercentage,
    discountPaise,
    subtotalPaise: grossSubtotalPaise,
    totalPaise,
  };
}

export interface CustomerMonthEstimate {
  customerId: string;
  period: BillingPeriod;
  instanceCalculations: InstanceUsageCalculation[];
  totalComputePaise: number;
  totalBackupPaise: number;
  totalDiscountPaise: number;
  totalEstimatedPaise: number;
  totalEstimatedRupees: number;
  activeInstancesCount: number;
}

/**
 * Calculates estimated month-to-date usage across all customer instances.
 * Only calculates UNBILLED usage (starting after the latest non-void invoice).
 */
export async function getCustomerMonthEstimate(
  customerId: string | mongoose.Types.ObjectId,
  referenceDate: Date = new Date()
): Promise<CustomerMonthEstimate> {
  await connectToDatabase();
  const period = getCurrentMonthPeriod(referenceDate);

  // Find latest non-void invoice to determine where unbilled usage begins
  const latestInvoice = await Invoice.findOne({
    customerId,
    status: { $in: ['PAID', 'OPEN', 'OVERDUE'] },
  })
    .sort({ 'billingPeriod.end': -1 })
    .lean();

  let unbilledStart = period.start;
  if (latestInvoice && latestInvoice.billingPeriod?.end) {
    const lastBilledEnd = new Date(latestInvoice.billingPeriod.end);
    if (lastBilledEnd.getTime() > unbilledStart.getTime()) {
      unbilledStart = lastBilledEnd;
    }
  }

  const unbilledPeriod: BillingPeriod = {
    start: unbilledStart,
    end: referenceDate,
  };

  // Find all instances belonging to customer that were active or terminated during this period
  const instances = await ManagedDatabase.find({
    $and: [
      { $or: [{ customerId }, { userId: customerId }] },
      { billingStartedAt: { $exists: true, $ne: null, $lte: unbilledPeriod.end } },
      { $or: [{ billingStoppedAt: { $exists: false } }, { billingStoppedAt: null }, { billingStoppedAt: { $gte: unbilledPeriod.start } }] },
    ],
  }).lean();

  const instanceCalculations: InstanceUsageCalculation[] = [];
  let totalComputePaise = 0;
  let totalBackupPaise = 0;
  let totalDiscountPaise = 0;
  let totalEstimatedPaise = 0;
  let activeCount = 0;

  for (const inst of instances) {
    const calc = calculateInstanceUsage(inst as unknown as IManagedDatabase, unbilledPeriod, referenceDate);
    if (calc.billableSeconds > 0 || inst.status === 'ACTIVE' || inst.status === 'RUNNING') {
      instanceCalculations.push(calc);
      totalComputePaise += calc.usageAmountPaise;
      totalBackupPaise += calc.backupAmountPaise;
      totalDiscountPaise += calc.discountPaise;
      totalEstimatedPaise += calc.totalPaise;
    }
    if (inst.status === 'ACTIVE' || inst.status === 'RUNNING') {
      activeCount++;
    }
  }

  return {
    customerId: customerId.toString(),
    period: unbilledPeriod,
    instanceCalculations,
    totalComputePaise,
    totalBackupPaise,
    totalDiscountPaise,
    totalEstimatedPaise,
    totalEstimatedRupees: totalEstimatedPaise / 100,
    activeInstancesCount: activeCount,
  };
}

export interface CustomerLiveUsageSummary {
  customerId: string;
  customerName: string;
  customerEmail: string;
  activeInstancesCount: number;
  totalInstancesCount: number;
  instances: Array<{
    id: string;
    name: string;
    planName: string;
    hourlyRatePaise: number;
    status: string;
    billableHours: number;
    usageAmountPaise: number;
    backupAmountPaise: number;
    discountPaise: number;
    totalPaise: number;
  }>;
  totalComputePaise: number;
  totalBackupPaise: number;
  totalDiscountPaise: number;
  totalUnbilledPaise: number;
  lastInvoiceNumber?: string;
  lastInvoiceDate?: string;
}

/**
 * Calculates live real-time accrued unbilled usage for all customers with instances.
 * Accurately excludes already-billed periods.
 */
export async function getAllCustomersLiveUsage(referenceDate: Date = new Date()): Promise<CustomerLiveUsageSummary[]> {
  await connectToDatabase();
  const period = getCurrentMonthPeriod(referenceDate);

  const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean();
  const summaries: CustomerLiveUsageSummary[] = [];

  for (const customer of customers) {
    const instances = await ManagedDatabase.find({
      $or: [{ customerId: customer._id }, { userId: customer._id }],
    }).lean();

    if (instances.length === 0) continue;

    // Find latest non-void invoice to start only from unbilled timestamp
    const lastInvoice = await Invoice.findOne({
      customerId: customer._id,
      status: { $in: ['PAID', 'OPEN', 'OVERDUE'] },
    })
      .sort({ 'billingPeriod.end': -1 })
      .lean();

    let unbilledStart = period.start;
    if (lastInvoice && lastInvoice.billingPeriod?.end) {
      const lastBilledEnd = new Date(lastInvoice.billingPeriod.end);
      if (lastBilledEnd.getTime() > unbilledStart.getTime()) {
        unbilledStart = lastBilledEnd;
      }
    }

    const unbilledPeriod: BillingPeriod = {
      start: unbilledStart,
      end: referenceDate,
    };

    let totalComputePaise = 0;
    let totalBackupPaise = 0;
    let totalDiscountPaise = 0;
    let totalUnbilledPaise = 0;
    let activeCount = 0;

    const instanceList = instances.map((inst) => {
      const calc = calculateInstanceUsage(inst as unknown as IManagedDatabase, unbilledPeriod, referenceDate);
      if (inst.status === 'ACTIVE' || inst.status === 'RUNNING') {
        activeCount++;
      }
      totalComputePaise += calc.usageAmountPaise;
      totalBackupPaise += calc.backupAmountPaise;
      totalDiscountPaise += calc.discountPaise;
      totalUnbilledPaise += calc.totalPaise;

      return {
        id: inst._id.toString(),
        name: inst.name,
        planName: calc.planName,
        hourlyRatePaise: calc.hourlyRatePaise,
        status: inst.status,
        billableHours: parseFloat(calc.billableHours.toFixed(2)),
        usageAmountPaise: calc.usageAmountPaise,
        backupAmountPaise: calc.backupAmountPaise,
        discountPaise: calc.discountPaise,
        totalPaise: calc.totalPaise,
      };
    });

    summaries.push({
      customerId: customer._id.toString(),
      customerName: customer.profile?.fullName || customer.email.split('@')[0],
      customerEmail: customer.email,
      activeInstancesCount: activeCount,
      totalInstancesCount: instances.length,
      instances: instanceList,
      totalComputePaise,
      totalBackupPaise,
      totalDiscountPaise,
      totalUnbilledPaise,
      lastInvoiceNumber: lastInvoice?.invoiceNumber,
      lastInvoiceDate: lastInvoice?.createdAt ? new Date(lastInvoice.createdAt).toISOString() : undefined,
    });
  }

  return summaries;
}

/**
 * Generates an immutable snapshot Invoice for a customer's unbilled usage.
 * Automatically starts from the end of the previous non-void invoice to prevent double-billing.
 */
export async function generateMonthlyInvoice(
  customerId: string | mongoose.Types.ObjectId,
  period: BillingPeriod
): Promise<IInvoice | null> {
  await connectToDatabase();
  const user = await User.findById(customerId);
  if (!user) {
    throw new Error(`Customer not found for ID: ${customerId}`);
  }

  // Find latest non-void invoice to guarantee we only bill NEW unbilled hours
  const latestInvoice = await Invoice.findOne({
    customerId: user._id,
    status: { $in: ['PAID', 'OPEN', 'OVERDUE'] },
  })
    .sort({ 'billingPeriod.end': -1 })
    .lean();

  let unbilledStart = period.start;
  if (latestInvoice && latestInvoice.billingPeriod?.end) {
    const lastBilledEnd = new Date(latestInvoice.billingPeriod.end);
    if (lastBilledEnd.getTime() > unbilledStart.getTime()) {
      unbilledStart = lastBilledEnd;
    }
  }

  // If already billed up to or past period.end, nothing new to invoice
  if (unbilledStart.getTime() >= period.end.getTime()) {
    return null;
  }

  const unbilledPeriod: BillingPeriod = {
    start: unbilledStart,
    end: period.end,
  };

  // Find instances with activity in the given unbilled period
  const instances = await ManagedDatabase.find({
    $and: [
      { $or: [{ customerId }, { userId: customerId }] },
      { billingStartedAt: { $exists: true, $ne: null, $lte: unbilledPeriod.end } },
      { $or: [{ billingStoppedAt: { $exists: false } }, { billingStoppedAt: null }, { billingStoppedAt: { $gte: unbilledPeriod.start } }] },
    ],
  }).lean();

  const lineItems: IInvoiceLineItem[] = [];
  let subtotalPaise = 0;
  let discountPaise = 0;
  let totalPaise = 0;

  for (const inst of instances) {
    const calc = calculateInstanceUsage(
      inst as unknown as IManagedDatabase,
      unbilledPeriod,
      unbilledPeriod.end
    );
    if (calc.billableSeconds > 0) {
      // If active for even a few seconds on a paid plan, ensure at least 1 paise compute
      const computePaise = calc.usageAmountPaise > 0 ? calc.usageAmountPaise : (calc.hourlyRatePaise > 0 ? 1 : 0);
      const itemSubtotal = computePaise + calc.backupAmountPaise;
      const discount = Math.round((itemSubtotal * (calc.couponDiscountPercentage || 0)) / 100);
      const itemTotal = Math.max(0, itemSubtotal - discount);

      lineItems.push({
        instanceId: inst._id as unknown as mongoose.Types.ObjectId,
        instanceName: inst.name,
        planId: inst.planId,
        planName: calc.planName,
        hourlyRatePaise: calc.hourlyRatePaise,
        billableHours: parseFloat(calc.billableHours.toFixed(2)),
        usageAmountPaise: computePaise,
        backupAmountPaise: calc.backupAmountPaise,
        discountPaise: discount,
        subtotalPaise: itemTotal,
        description: `${calc.planName} Database: ${calc.billableHours.toFixed(1)} hrs @ ${formatPaiseToRupees(calc.effectiveHourlyRatePaise)}/hr${
          calc.couponDiscountPercentage > 0 ? ` (Base: ${formatPaiseToRupees(calc.hourlyRatePaise)}/hr, -${calc.couponDiscountPercentage}% Coupon: -${formatPaiseToRupees(discount)})` : ''
        }${calc.backupAmountPaise > 0 ? ` + Backup: ${formatPaiseToRupees(calc.backupAmountPaise)}` : ''}`,
      });

      subtotalPaise += itemSubtotal;
      discountPaise += discount;
      totalPaise += itemTotal;
    }
  }

  // Invoices below ₹5 (500 paise) are rejected to prevent micro-billing transactions
  if (lineItems.length === 0 || totalPaise < MIN_INVOICE_AMOUNT_PAISE) {
    return null;
  }

  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days payment window
  const yearMonth = `${unbilledPeriod.start.getFullYear()}${String(unbilledPeriod.start.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const invoiceNumber = `INV-${yearMonth}-${randomSuffix}`;

  const customerName = user.profile?.fullName || user.email.split('@')[0];

  const invoice = await Invoice.create({
    invoiceNumber,
    customerId: user._id,
    customerName,
    customerEmail: user.email,
    billingPeriod: {
      start: unbilledPeriod.start,
      end: unbilledPeriod.end,
    },
    issueDate,
    dueDate,
    lineItems,
    subtotalPaise,
    discountPaise,
    taxPaise: 0,
    totalPaise,
    status: 'OPEN',
  });

  return invoice;
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
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
