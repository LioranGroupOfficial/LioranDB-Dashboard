'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  RotateCw,
  Play,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  User,
  ArrowUpRight,
  Filter,
  Printer,
  ChevronRight,
  Check,
  X,
  Database,
  Sparkles,
  Info,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';
import { CustomerLiveUsageSummary } from '@/lib/billing';

export interface AdminInvoiceLineItem {
  instanceName: string;
  planName: string;
  hourlyRatePaise: number;
  billableHours: number;
  usageAmountPaise: number;
  backupAmountPaise: number;
  discountPaise: number;
  subtotalPaise: number;
  description?: string;
}

export interface AdminInvoiceItem {
  _id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  issueDate: string;
  dueDate: string;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';
  paidAt?: string | null;
  paymentTransactionReference?: string | null;
  lineItemsCount: number;
  lineItems?: AdminInvoiceLineItem[];
  createdAt: string;
}

export interface CustomerOption {
  _id: string;
  email: string;
  name: string;
}

interface Props {
  initialInvoices: AdminInvoiceItem[];
  initialLiveUsage: CustomerLiveUsageSummary[];
  customers: CustomerOption[];
}

export default function AdminBillingClient({
  initialInvoices,
  initialLiveUsage,
  customers,
}: Props) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<AdminInvoiceItem[]>(initialInvoices);
  const [liveUsage, setLiveUsage] = useState<CustomerLiveUsageSummary[]>(initialLiveUsage);
  const [tab, setTab] = useState<'INVOICES' | 'LIVE_USAGE'>('INVOICES');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modals state
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoiceItem | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<AdminInvoiceItem | null>(null);
  const [manualUtr, setManualUtr] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Billing cycle run form state
  const [cyclePeriodType, setCyclePeriodType] = useState<'CURRENT_MONTH' | 'PREVIOUS_MONTH' | 'ALL_UNBILLED'>('CURRENT_MONTH');
  const [cycleTargetCustomer, setCycleTargetCustomer] = useState<string>('ALL');
  const [forceGenerate, setForceGenerate] = useState(false);

  // Refresh data from server
  async function refreshData() {
    setLoading(true);
    try {
      const [invRes, usageRes] = await Promise.all([
        fetch('/api/admin/billing/invoices'),
        fetch('/api/admin/billing/usage'),
      ]);
      const invData = await invRes.json();
      const usageData = await usageRes.json();

      if (invData.success && invData.invoices) {
        setInvoices(invData.invoices);
      }
      if (usageData.success && usageData.usage) {
        setLiveUsage(usageData.usage);
      }
      router.refresh();
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerEmail.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  // Filtered live usage
  const filteredUsage = useMemo(() => {
    const q = search.trim().toLowerCase();
    return liveUsage.filter((u) => {
      if (!q) return true;
      return (
        u.customerEmail.toLowerCase().includes(q) ||
        u.customerName.toLowerCase().includes(q) ||
        u.instances.some((inst) => inst.name.toLowerCase().includes(q))
      );
    });
  }, [liveUsage, search]);

  // Statistics
  const stats = useMemo(() => {
    const settledRevenuePaise = invoices
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + i.totalPaise, 0);

    const awaitingSettlementPaise = invoices
      .filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.totalPaise, 0);

    const totalLiveAccruedPaise = liveUsage.reduce(
      (sum, u) => sum + u.totalUnbilledPaise,
      0
    );

    const openOrOverdueCount = invoices.filter(
      (i) => i.status === 'OPEN' || i.status === 'OVERDUE'
    ).length;

    return {
      settledRevenuePaise,
      awaitingSettlementPaise,
      totalLiveAccruedPaise,
      totalInvoicesCount: invoices.length,
      openOrOverdueCount,
    };
  }, [invoices, liveUsage]);

  // Run billing cycle handler
  async function handleExecuteBillingRun() {
    setGenerating(true);
    setFeedbackMsg(null);

    try {
      const payload: Record<string, unknown> = {
        periodType: cyclePeriodType,
        forceGenerate,
      };
      if (cycleTargetCustomer !== 'ALL') {
        payload.customerId = cycleTargetCustomer;
      }

      const res = await fetch('/api/admin/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate billing cycle');

      setFeedbackMsg({
        type: 'success',
        text: data.message || `Billing cycle complete. Generated ${data.result?.invoicesGenerated || 0} invoices.`,
      });

      setCycleModalOpen(false);
      await refreshData();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error generating billing cycle',
      });
    } finally {
      setGenerating(false);
    }
  }

  // Quick single customer invoice generation
  async function handleGenerateCustomerInvoice(customerId: string, customerName: string) {
    if (!confirm(`Generate current usage invoice immediately for ${customerName}?`)) return;

    setGenerating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/admin/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType: 'CURRENT_MONTH',
          customerId,
          forceGenerate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invoice generation failed');

      setFeedbackMsg({
        type: 'success',
        text: data.message || `Invoice generated for ${customerName}.`,
      });
      await refreshData();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate invoice',
      });
    } finally {
      setGenerating(false);
    }
  }

  // Mark invoice as paid
  async function handleConfirmMarkPaid() {
    if (!markPaidInvoice) return;
    const ref = manualUtr.trim() || `MANUAL-${Date.now()}`;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${markPaidInvoice._id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark invoice as paid');

      setInvoices((prev) =>
        prev.map((i) =>
          i._id === markPaidInvoice._id
            ? {
                ...i,
                status: 'PAID',
                paidAt: new Date().toISOString(),
                paymentTransactionReference: ref,
              }
            : i
        )
      );

      if (selectedInvoice && selectedInvoice._id === markPaidInvoice._id) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: 'PAID',
          paidAt: new Date().toISOString(),
          paymentTransactionReference: ref,
        });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Invoice ${markPaidInvoice.invoiceNumber} marked as PAID. Reference: ${ref}`,
      });
      setMarkPaidInvoice(null);
      setManualUtr('');
      router.refresh();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Mark paid failed',
      });
    } finally {
      setLoading(false);
    }
  }

  // Void invoice
  async function handleVoidInvoice(id: string, invoiceNumber: string) {
    if (!confirm(`Are you sure you want to void invoice ${invoiceNumber}? This action cannot be undone.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${id}/void`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Void failed');

      setInvoices((prev) =>
        prev.map((i) => (i._id === id ? { ...i, status: 'VOID' } : i))
      );

      if (selectedInvoice && selectedInvoice._id === id) {
        setSelectedInvoice({ ...selectedInvoice, status: 'VOID' });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Invoice ${invoiceNumber} has been voided.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Void invoice failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Billing &amp; Invoicing</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Authoritative server-generated postpaid usage invoices, real-time live usage telemetry, and settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={refreshData}
            title="Refresh billing data"
            className="btn-secondary py-2 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            disabled={generating}
            onClick={() => setCycleModalOpen(true)}
            className="btn-primary py-2 px-4 min-h-[38px] text-xs inline-flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Billing Invoicing Cycle</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-[7px] border text-xs flex items-center justify-between transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-[var(--surface-soft)] border-[var(--border-strong)] text-[var(--text-strong)]'
              : 'bg-[var(--surface-soft)] border-[var(--border-strong)] text-[var(--text-strong)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)] ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Settled Revenue</span>
            <CheckCircle2 className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {formatPaiseToRupees(stats.settledRevenuePaise)}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            {invoices.filter((i) => i.status === 'PAID').length} invoices settled
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Awaiting Settlement</span>
            <Clock className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {formatPaiseToRupees(stats.awaitingSettlementPaise)}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            {stats.openOrOverdueCount} open / overdue invoices
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Live Accrued (Unbilled)</span>
            <Sparkles className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {formatPaiseToRupees(stats.totalLiveAccruedPaise)}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Across {liveUsage.length} active customer fleets
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Total Invoices</span>
            <Receipt className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {stats.totalInvoicesCount}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            All historical billing cycles
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <button
          type="button"
          onClick={() => setTab('INVOICES')}
          className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors inline-flex items-center gap-2 ${
            tab === 'INVOICES'
              ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Invoices Ledger ({invoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('LIVE_USAGE')}
          className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors inline-flex items-center gap-2 ${
            tab === 'LIVE_USAGE'
              ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Live Accrued Usage ({liveUsage.length} Customers)</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'INVOICES'
                ? 'Search by invoice #, customer name, or email...'
                : 'Search customers or database names...'
            }
            className="input-field pl-9 w-full"
          />
        </div>

        {tab === 'INVOICES' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] text-xs text-[var(--text-secondary)]">
              <span className="font-mono text-[11px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter invoices by status"
                className="bg-transparent text-[var(--text-strong)] focus:outline-hidden cursor-pointer font-medium"
              >
                <option value="ALL" className="bg-[var(--surface)] text-[var(--text-primary)]">All</option>
                <option value="OPEN" className="bg-[var(--surface)] text-[var(--text-primary)]">Open</option>
                <option value="PAID" className="bg-[var(--surface)] text-[var(--text-primary)]">Paid</option>
                <option value="OVERDUE" className="bg-[var(--surface)] text-[var(--text-primary)]">Overdue</option>
                <option value="VOID" className="bg-[var(--surface)] text-[var(--text-primary)]">Void</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: INVOICES LEDGER */}
      {tab === 'INVOICES' && (
        <div className="card p-0 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] uppercase font-mono border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)] text-xs font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="w-6 h-6 opacity-40" />
                        <span>No invoices found matching criteria.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv._id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--text-strong)]">
                        <div className="flex items-center gap-1.5">
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-[var(--text-strong)] text-xs font-bold font-sans">
                          {inv.customerName}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          {inv.customerEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                        {new Date(inv.billingPeriod.start).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        –{' '}
                        {new Date(inv.billingPeriod.end).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-xs text-[var(--text-strong)]">
                        {formatPaiseToRupees(inv.totalPaise)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-mono uppercase tracking-wider ${
                            inv.status === 'PAID'
                              ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-semibold'
                              : inv.status === 'OVERDUE'
                              ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold'
                              : inv.status === 'OPEN'
                              ? 'bg-[var(--surface-soft)] text-[var(--text-primary)] border border-[var(--border)]'
                              : 'line-through text-[var(--text-muted)] border border-[var(--border)]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td
                        className="px-4 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2 py-1 text-[11px] btn-secondary"
                          >
                            Details
                          </button>

                          {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setMarkPaidInvoice(inv);
                                  setManualUtr(`UTR-${Date.now().toString().slice(-8)}`);
                                }}
                                className="px-2 py-1 text-[11px] btn-primary"
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVoidInvoice(inv._id, inv.invoiceNumber)}
                                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-strong)] border border-transparent hover:border-[var(--border)] rounded-[6px]"
                              >
                                Void
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ACCRUED USAGE (REAL-TIME TELEMETRY) */}
      {tab === 'LIVE_USAGE' && (
        <div className="space-y-4">
          <div className="p-3 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text-strong)]">
                Real-Time Postpaid Telemetry
              </p>
              <p className="mt-0.5 text-[var(--text-muted)]">
                This table computes active runtime seconds, hourly plan rates, backup add-ons, and coupon discounts
                accumulated since the start of the current month. You can generate immediate snapshot invoices per customer at any time.
              </p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] uppercase font-mono border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Databases</th>
                    <th className="px-4 py-3 font-medium">Billable Hours</th>
                    <th className="px-4 py-3 font-medium">Compute (₹)</th>
                    <th className="px-4 py-3 font-medium">Backups (₹)</th>
                    <th className="px-4 py-3 font-medium">Unbilled Total</th>
                    <th className="px-4 py-3 font-medium">Last Invoiced</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {filteredUsage.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)] text-xs font-sans">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Database className="w-6 h-6 opacity-40" />
                          <span>No customer databases found with active usage.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsage.map((u) => {
                      const totalHours = u.instances.reduce((sum, i) => sum + i.billableHours, 0);

                      return (
                        <tr key={u.customerId} className="hover:bg-[var(--surface-soft)] transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="text-[var(--text-strong)] text-xs font-bold font-sans">
                              {u.customerName}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] font-mono">
                              {u.customerEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-[var(--text-strong)] font-semibold">
                              {u.activeInstancesCount} active / {u.totalInstancesCount} total
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
                              {u.instances.map((i) => i.name).join(', ')}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-strong)] font-bold">
                            {totalHours.toFixed(1)} hrs
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                            {formatPaiseToRupees(u.totalComputePaise)}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                            {formatPaiseToRupees(u.totalBackupPaise)}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-xs text-[var(--text-strong)]">
                            {formatPaiseToRupees(u.totalUnbilledPaise)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                            {u.lastInvoiceNumber ? (
                              <div>
                                <span className="font-semibold text-[var(--text-secondary)]">{u.lastInvoiceNumber}</span>
                                {u.lastInvoiceDate && (
                                  <div className="text-[10px]">
                                    {new Date(u.lastInvoiceDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              'Never Invoiced'
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              disabled={generating}
                              onClick={() => handleGenerateCustomerInvoice(u.customerId, u.customerName)}
                              className="px-2.5 py-1 text-[11px] btn-primary inline-flex items-center gap-1.5"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Generate Invoice</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: RUN BILLING INVOICING CYCLE */}
      {cycleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--text-strong)]" />
                <h3 className="text-base font-bold text-[var(--text-strong)]">Run Billing Invoicing Cycle</h3>
              </div>
              <button
                type="button"
                onClick={() => setCycleModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              This initiates authoritative server-side billing calculation across active managed databases, generating snapshot invoices and notifying customers.
            </p>

            <div className="space-y-4">
              {/* Cycle Period */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Billing Cycle Period
                </label>
                <select
                  value={cyclePeriodType}
                  onChange={(e) => setCyclePeriodType(e.target.value as unknown as typeof cyclePeriodType)}
                  className="input-field w-full text-xs font-medium cursor-pointer"
                >
                  <option value="CURRENT_MONTH">Current Month to Date (Recommended for mid-month runs &amp; active usage)</option>
                  <option value="PREVIOUS_MONTH">Previous Calendar Month (Standard end-of-month rollover)</option>
                  <option value="ALL_UNBILLED">All Unbilled Usage to Date (From database creation)</option>
                </select>
              </div>

              {/* Target Customer */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Target Customer Fleet
                </label>
                <select
                  value={cycleTargetCustomer}
                  onChange={(e) => setCycleTargetCustomer(e.target.value)}
                  className="input-field w-full text-xs font-medium cursor-pointer"
                >
                  <option value="ALL">All Active Customers (Fleet-Wide Run)</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Force Regenerate Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="forceGen"
                  checked={forceGenerate}
                  onChange={(e) => setForceGenerate(e.target.checked)}
                  className="mt-0.5 cursor-pointer accent-black dark:accent-white"
                />
                <label htmlFor="forceGen" className="text-xs text-[var(--text-secondary)] cursor-pointer">
                  <span className="font-semibold text-[var(--text-strong)]">Allow incremental / re-run invoices:</span> Generate new invoice even if an invoice already exists for this exact period window.
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                disabled={generating}
                onClick={() => setCycleModalOpen(false)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleExecuteBillingRun}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Billing Run...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Billing Run</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE DETAILS MODAL & PRINT SLIP */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[var(--text-strong)] font-mono">
                    {selectedInvoice.invoiceNumber}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider ${
                      selectedInvoice.status === 'PAID'
                        ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold'
                        : selectedInvoice.status === 'OVERDUE'
                        ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold'
                        : 'bg-[var(--surface-soft)] text-[var(--text-primary)] border border-[var(--border)]'
                    }`}
                  >
                    {selectedInvoice.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Issued: {new Date(selectedInvoice.issueDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Period Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--surface-soft)] p-4 rounded-[7px] border border-[var(--border)]">
              <div>
                <span className="text-[var(--text-muted)] font-mono uppercase text-[10px]">Billed Customer</span>
                <p className="font-bold text-[var(--text-strong)] mt-0.5">{selectedInvoice.customerName}</p>
                <p className="text-[var(--text-secondary)] font-mono">{selectedInvoice.customerEmail}</p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">ID: {selectedInvoice.customerId}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-mono uppercase text-[10px]">Billing Window &amp; Due Date</span>
                <p className="font-medium text-[var(--text-strong)] mt-0.5">
                  {new Date(selectedInvoice.billingPeriod.start).toLocaleDateString()} – {new Date(selectedInvoice.billingPeriod.end).toLocaleDateString()}
                </p>
                <p className="text-[var(--text-muted)] mt-1">
                  Payment Due: <span className="font-mono font-semibold text-[var(--text-strong)]">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                </p>
              </div>
            </div>

            {/* Line Items Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Itemized Usage Breakdown ({selectedInvoice.lineItemsCount} items)
              </h4>
              <div className="border border-[var(--border)] rounded-[7px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] font-mono border-b border-[var(--border)]">
                    <tr>
                      <th className="px-3 py-2">Item / Instance</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Rate</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-mono">
                    {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? (
                      selectedInvoice.lineItems.map((li, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-soft)]">
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-[var(--text-strong)] font-sans">{li.instanceName}</div>
                            {li.description && (
                              <div className="text-[10px] text-[var(--text-muted)] font-sans">{li.description}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{li.planName}</td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{formatPaiseToRupees(li.hourlyRatePaise)}/hr</td>
                          <td className="px-3 py-2.5 text-[var(--text-strong)]">{li.billableHours} hrs</td>
                          <td className="px-3 py-2.5 text-right font-bold text-[var(--text-strong)]">
                            {formatPaiseToRupees(li.subtotalPaise)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-[var(--text-muted)]">
                          Standard Managed Instance Usage
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Calculation */}
            <div className="border-t border-[var(--border)] pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--text-secondary)] font-mono">
                <span>Subtotal</span>
                <span>{formatPaiseToRupees(selectedInvoice.subtotalPaise)}</span>
              </div>
              {selectedInvoice.discountPaise > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)] font-mono">
                  <span>Coupon Discount</span>
                  <span>-{formatPaiseToRupees(selectedInvoice.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-secondary)] font-mono">
                <span>Taxes &amp; GST (0%)</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[var(--text-strong)] font-mono pt-2 border-t border-[var(--border)]">
                <span>Total Due</span>
                <span>{formatPaiseToRupees(selectedInvoice.totalPaise)}</span>
              </div>
            </div>

            {/* Payment Settlement Information */}
            {selectedInvoice.status === 'PAID' && (
              <div className="p-3.5 bg-[var(--surface-soft)] border border-[var(--border-strong)] rounded-[7px] text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--text-strong)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--text-strong)]" />
                  <span>Settlement Confirmed</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  <div>
                    <span className="text-[var(--text-muted)]">Paid At:</span>{' '}
                    {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString('en-IN') : 'Confirmed'}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Reference / UTR:</span>{' '}
                    <span className="font-bold text-[var(--text-strong)]">{selectedInvoice.paymentTransactionReference || 'AUTO-PROCESSED'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'VOID' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMarkPaidInvoice(selectedInvoice);
                        setManualUtr(`UTR-${Date.now().toString().slice(-8)}`);
                      }}
                      className="btn-primary text-xs py-2 px-3.5"
                    >
                      Mark Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoidInvoice(selectedInvoice._id, selectedInvoice.invoiceNumber)}
                      className="btn-secondary text-xs py-2 px-3 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    >
                      Void Invoice
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MARK INVOICE AS PAID WITH UTR */}
      {markPaidInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-strong)]">Mark Invoice as Paid</h3>
              <button
                type="button"
                onClick={() => setMarkPaidInvoice(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Record manual offline settlement or gateway reconciliation for invoice{' '}
              <span className="font-mono font-bold text-[var(--text-strong)]">{markPaidInvoice.invoiceNumber}</span>{' '}
              ({formatPaiseToRupees(markPaidInvoice.totalPaise)}).
            </p>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Bank Transaction Reference / UTR / Gateway Payment ID
              </label>
              <input
                type="text"
                value={manualUtr}
                onChange={(e) => setManualUtr(e.target.value)}
                placeholder="e.g. UTR12345678 or MANUAL-UTR"
                className="input-field w-full text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setMarkPaidInvoice(null)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmMarkPaid}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm Payment Recorded</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
