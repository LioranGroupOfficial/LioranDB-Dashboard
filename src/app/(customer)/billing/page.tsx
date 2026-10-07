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
          <h1 className="font-serif text-3xl font-normal text-white tracking-tight">
            Usage Billing &amp; Invoices
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Postpaid usage-based billing. Hourly usage accumulates server-side and is invoiced at the end of each billing month.
          </p>
        </div>

        <Link
          href="/usage"
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors self-start sm:self-auto"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Detailed Usage Breakdown</span>
        </Link>
      </div>

      {/* Current Month Estimate Hero Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Current Month (Estimated)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                ESTIMATED
              </span>
            </div>
            <div className="font-serif text-4xl sm:text-5xl font-bold text-white tracking-tight">
              {formatPaiseToRupees(estimate.totalEstimatedPaise)}
            </div>
            <p className="text-xs text-slate-400">
              Month-to-date accumulated compute and backup usage for {estimate.activeInstancesCount} active database instance{estimate.activeInstancesCount === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800 pt-6 text-xs font-mono">
          <div>
            <span className="text-slate-500 uppercase block">Compute Usage</span>
            <span className="text-sm font-bold text-white mt-1 block">
              {formatPaiseToRupees(estimate.totalComputePaise)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase block">Backup Addons (Prorated)</span>
            <span className="text-sm font-bold text-white mt-1 block">
              {formatPaiseToRupees(estimate.totalBackupPaise)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase block">Discounts Applied</span>
            <span className="text-sm font-bold text-emerald-400 mt-1 block">
              {estimate.totalDiscountPaise > 0 ? `-${formatPaiseToRupees(estimate.totalDiscountPaise)}` : '₹0'}
            </span>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-normal text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              Monthly Invoices ({invoices.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical immutable snapshots generated at the end of each billing month.
            </p>
          </div>
        </div>

        <InvoicesList initialInvoices={serializedInvoices} />
      </div>
    </div>
  );
}
