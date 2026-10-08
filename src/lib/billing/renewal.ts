import { connectToDatabase, User, Invoice } from '../db';
import { getPreviousMonthPeriod, getCurrentMonthPeriod, generateMonthlyInvoice, BillingPeriod } from './index';
import { createNotification } from '../notifications';
import { sendEmail } from '../email';
import { formatPaiseToRupees } from '../plans';

export interface BillingCycleOptions {
  periodType?: 'CURRENT_MONTH' | 'PREVIOUS_MONTH' | 'ALL_UNBILLED' | 'CUSTOM';
  customerId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  forceGenerate?: boolean;
}

export interface GeneratedInvoiceSummary {
  _id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalPaise: number;
  totalRupees: number;
}

export interface MonthlyBillingResult {
  invoicesGenerated: number;
  totalAmountPaise: number;
  invoices: GeneratedInvoiceSummary[];
  overdueInvoicesCount: number;
  errors: Array<{ customerId: string; error: string }>;
}

/**
 * Scheduled cron or manual admin execution to generate usage-based monthly invoices for customers.
 */
export async function processMonthlyBillingInvoices(
  options: BillingCycleOptions = {}
): Promise<MonthlyBillingResult> {
  await connectToDatabase();
  const now = new Date();

  // Determine billing period based on options
  let period: BillingPeriod;
  if (options.periodType === 'CURRENT_MONTH') {
    const current = getCurrentMonthPeriod(now);
    period = { start: current.start, end: now };
  } else if (options.periodType === 'ALL_UNBILLED') {
    period = { start: new Date('2020-01-01T00:00:00Z'), end: now };
  } else if (options.periodType === 'CUSTOM' && options.startDate && options.endDate) {
    period = {
      start: new Date(options.startDate),
      end: new Date(options.endDate),
    };
  } else {
    // Default to previous calendar month
    period = getPreviousMonthPeriod(now);
  }

  const result: MonthlyBillingResult = {
    invoicesGenerated: 0,
    totalAmountPaise: 0,
    invoices: [],
    overdueInvoicesCount: 0,
    errors: [],
  };

  // 1. Fetch targeted customers or all active customers
  const customerQuery: Record<string, unknown> = { role: 'customer' };
  if (options.customerId) {
    customerQuery._id = options.customerId;
  }

  const customers = await User.find(customerQuery).lean();

  for (const customer of customers) {
    try {
      // Check if invoice already generated for this customer & exact period unless forceGenerate is enabled
      if (!options.forceGenerate) {
        const existing = await Invoice.findOne({
          customerId: customer._id,
          'billingPeriod.start': period.start,
          'billingPeriod.end': period.end,
        });
        if (existing) {
          continue;
        }
      }

      const invoice = await generateMonthlyInvoice(customer._id, period);
      if (invoice) {
        result.invoicesGenerated++;
        result.totalAmountPaise += invoice.totalPaise;
        result.invoices.push({
          _id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId.toString(),
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          totalPaise: invoice.totalPaise,
          totalRupees: invoice.totalPaise / 100,
        });

        await createNotification({
          userId: customer._id.toString(),
          type: 'PAYMENT_DUE',
          title: 'Monthly Usage Invoice Generated',
          body: `Your invoice ${invoice.invoiceNumber} for ${formatPaiseToRupees(
            invoice.totalPaise
          )} has been generated. Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.`,
          link: `/billing`,
        });

        try {
          await sendEmail({
            to: customer.email,
            subject: `LioranDB Usage Invoice: ${invoice.invoiceNumber}`,
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2>LioranDB Usage Invoice</h2>
              <p>Hello ${invoice.customerName},</p>
              <p>Your usage invoice <strong>${invoice.invoiceNumber}</strong> has been generated.</p>
              <p><strong>Total Amount:</strong> ${formatPaiseToRupees(invoice.totalPaise)}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
              <p><a href="${process.env.APP_URL || 'https://app.liorandb.com'}/billing" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">View & Pay Invoice</a></p>
            </div>`,
          });
        } catch {
          // Email dispatch is best-effort
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown billing generation error';
      result.errors.push({ customerId: customer._id.toString(), error: errMsg });
    }
  }

  // 2. Mark past-due OPEN invoices as OVERDUE
  const overdueInvoices = await Invoice.find({
    status: 'OPEN',
    dueDate: { $lt: now },
  });

  for (const inv of overdueInvoices) {
    inv.status = 'OVERDUE';
    await inv.save();
    result.overdueInvoicesCount++;
  }

  return result;
}
