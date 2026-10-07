import { connectToDatabase, User, Invoice } from '../db';
import { getPreviousMonthPeriod, generateMonthlyInvoice } from './index';
import { createNotification } from '../notifications';
import { sendEmail } from '../email';
import { formatPaiseToRupees } from '../plans';

export interface MonthlyBillingResult {
  invoicesGenerated: number;
  overdueInvoicesCount: number;
  errors: Array<{ customerId: string; error: string }>;
}

/**
 * Scheduled cron job to generate usage-based monthly invoices for all customers.
 */
export async function processMonthlyBillingInvoices(): Promise<MonthlyBillingResult> {
  await connectToDatabase();
  const now = new Date();
  const period = getPreviousMonthPeriod(now);

  const result: MonthlyBillingResult = {
    invoicesGenerated: 0,
    overdueInvoicesCount: 0,
    errors: [],
  };

  // 1. Generate invoices for previous month
  const customers = await User.find({ role: 'customer' }).lean();

  for (const customer of customers) {
    try {
      // Check if invoice already generated for this customer & period
      const existing = await Invoice.findOne({
        customerId: customer._id,
        'billingPeriod.start': period.start,
        'billingPeriod.end': period.end,
      });

      if (!existing) {
        const invoice = await generateMonthlyInvoice(customer._id, period);
        if (invoice) {
          result.invoicesGenerated++;

          await createNotification({
            userId: customer._id.toString(),
            type: 'PAYMENT_DUE',
            title: 'Monthly Usage Invoice Generated',
            body: `Your invoice ${invoice.invoiceNumber} for ${formatPaiseToRupees(
              invoice.totalPaise
            )} has been generated. Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.`,
            link: `/billing`,
          });

          await sendEmail({
            to: customer.email,
            subject: `LioranDB Monthly Invoice: ${invoice.invoiceNumber}`,
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2>LioranDB Usage Invoice</h2>
              <p>Hello ${invoice.customerName},</p>
              <p>Your monthly usage invoice <strong>${invoice.invoiceNumber}</strong> is ready.</p>
              <p><strong>Total Amount:</strong> ${formatPaiseToRupees(invoice.totalPaise)}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
              <p><a href="${process.env.APP_URL || 'https://app.liorandb.com'}/billing" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">View & Pay Invoice</a></p>
            </div>`,
          });
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
