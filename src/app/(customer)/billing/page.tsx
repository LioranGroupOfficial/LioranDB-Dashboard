import React from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';
import { getCustomerMonthEstimate } from '@/lib/billing';
import { formatPaiseToRupees } from '@/lib/plans';
import InvoicesList from '@/components/billing/InvoicesList';
import {
  Receipt,
  Activity,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import type { IInvoice, IInvoiceLineItem } from '@/lib/db/models/Invoice';

export const metadata = { title: 'Billing & Invoices — LioranDB' };

export default async function BillingPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const [estimate, invoices] = await Promise.all([
    getCustomerMonthEstimate(sessionUser.userId),
    Invoice.find({ customerId: sessionUser.userId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const serializedInvoices = (invoices as unknown as IInvoice[]).map((inv) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    billingPeriod: {
      start: inv.billingPeriod?.start ? new Date(inv.billingPeriod.start).toISOString() : new Date().toISOString(),
      end: inv.billingPeriod?.end ? new Date(inv.billingPeriod.end).toISOString() : new Date().toISOString(),
    },
    issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
    lineItems: (inv.lineItems || []).map((item: IInvoiceLineItem) => ({
      instanceName: item.instanceName,
      planName: item.planName,
      hourlyRatePaise: item.hourlyRatePaise,
      billableHours: item.billableHours,
      usageAmountPaise: item.usageAmountPaise,
      backupAmountPaise: item.backupAmountPaise,
      discountPaise: item.discountPaise,
      subtotalPaise: item.subtotalPaise,
      description: item.description,
    })),
    subtotalPaise: inv.subtotalPaise,
    discountPaise: inv.discountPaise,
    taxPaise: inv.taxPaise || 0,
    totalPaise: inv.totalPaise,
    status: inv.status,
    paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : undefined,
    paymentId: inv.paymentTransactionReference,
  }));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] tracking-tight">
            Usage Billing &amp; Invoices
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Postpaid usage-based billing. Hourly usage accumulates server-side and is invoiced at the end of each billing month.
          </p>
        </div>

        <Link
          href="/usage"
          className="btn-secondary py-2 px-3.5 min-h-[38px] text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Detailed Usage Breakdown</span>
        </Link>
      </div>

      {/* Current Month Estimate Hero Card */}
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <Activity className="w-4 h-4 text-[var(--text-strong)]" />
              <span>Current Month (Estimated)</span>
              <span className="badge badge-active font-bold">
                ESTIMATED
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-[var(--text-strong)] font-mono tracking-tight">
              {formatPaiseToRupees(estimate.totalEstimatedPaise)}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Month-to-date accumulated compute and backup usage for {estimate.activeInstancesCount} active database instance{estimate.activeInstancesCount === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[var(--border)] pt-6 text-xs font-mono">
          <div>
            <span className="text-[var(--text-muted)] uppercase block">Compute Usage</span>
            <span className="text-sm font-bold text-[var(--text-strong)] mt-1 block">
              {formatPaiseToRupees(estimate.totalComputePaise)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] uppercase block">Backup Addons (Prorated)</span>
            <span className="text-sm font-bold text-[var(--text-strong)] mt-1 block">
              {formatPaiseToRupees(estimate.totalBackupPaise)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] uppercase block">Discounts Applied</span>
            <span className="text-sm font-bold text-[var(--text-strong)] mt-1 block">
              {estimate.totalDiscountPaise > 0 ? `-${formatPaiseToRupees(estimate.totalDiscountPaise)}` : '₹0'}
            </span>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[var(--text-strong)]" />
              Monthly Invoices ({invoices.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Historical immutable snapshots generated at the end of each billing month.
            </p>
          </div>
        </div>

        <InvoicesList initialInvoices={serializedInvoices} />
      </div>
    </div>
  );
}
