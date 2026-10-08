'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  DollarSign,
  Calendar,
  Play,
  RotateCw,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

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
  createdAt: string;
}

interface Props {
  initialInvoices: AdminInvoiceItem[];
}

export default function AdminBillingClient({ initialInvoices }: Props) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<AdminInvoiceItem[]>(initialInvoices);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerEmail.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenuePaise = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + i.totalPaise, 0);

  const pendingSettlementPaise = invoices
    .filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + i.totalPaise, 0);

  async function handleGenerateBatchInvoices() {
    if (!confirm('Run monthly billing cycle now? This generates invoices for all active customer usage.')) return;
    setGenerating(true);

    try {
      const res = await fetch('/api/admin/billing/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      alert(`Billing cycle complete: ${data.message || 'Invoices generated'}`);
      router.refresh();

      const invRes = await fetch('/api/admin/billing/invoices');
      const invData = await invRes.json();
      if (invData.success) setInvoices(invData.invoices);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Batch generation error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkPaid(id: string) {
    const ref = prompt('Enter payment transaction reference / UTR / receipt notes:', 'MANUAL-UTR');
    if (!ref) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/billing/invoices/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mark paid failed');
      setInvoices((prev) =>
        prev.map((i) => (i._id === id ? { ...i, status: 'PAID', paidAt: new Date().toISOString() } : i))
      );
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Mark paid failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid(id: string) {
    if (!confirm('Are you sure you want to void this invoice?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/billing/invoices/${id}/void`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Void failed');
      setInvoices((prev) =>
        prev.map((i) => (i._id === id ? { ...i, status: 'VOID' } : i))
      );
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Void failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Billing &amp; Invoicing</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Authoritative server-generated postpaid usage invoices and payment settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateBatchInvoices}
          className="btn-primary py-2 px-4 min-h-[38px] text-xs inline-flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Processing Cycle...' : 'Run Billing Invoicing Cycle'}</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Total Settled Revenue</span>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {formatPaiseToRupees(totalRevenuePaise)}
          </p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Awaiting Settlement</span>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {formatPaiseToRupees(pendingSettlementPaise)}
          </p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Total Invoices</span>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{invoices.length}</p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Open / Overdue</span>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {invoices.filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE').length}
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, customer name, or email..."
            className="input-field pl-9"
          />
        </div>

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
      </div>

      {/* Invoices Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
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
                  <td colSpan={7} className="px-6 py-10 text-center text-[var(--muted)] text-xs font-sans">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--text-strong)]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-[var(--text-strong)] text-xs font-bold font-sans">{inv.customerName}</div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{inv.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                      {new Date(inv.billingPeriod.start).toLocaleDateString()} – {new Date(inv.billingPeriod.end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--text-strong)]">
                      {formatPaiseToRupees(inv.totalPaise)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`badge ${
                          inv.status === 'PAID'
                            ? 'badge-active'
                            : inv.status === 'OPEN'
                            ? 'badge-info'
                            : inv.status === 'OVERDUE'
                            ? 'badge-suspended'
                            : 'badge-default'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleMarkPaid(inv._id)}
                            className="btn-primary py-1 px-2.5 min-h-[30px] text-[11px]"
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleVoid(inv._id)}
                            className="btn-secondary py-1 px-2.5 min-h-[30px] text-[11px]"
                          >
                            Void
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
