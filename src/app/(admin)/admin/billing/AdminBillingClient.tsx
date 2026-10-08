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
          <h1 className="text-2xl font-bold text-white tracking-tight">Billing &amp; Invoicing</h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative server-generated postpaid usage invoices and payment settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateBatchInvoices}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-xs shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Processing Cycle...' : 'Run Billing Invoicing Cycle'}</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Total Settled Revenue</span>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-2">
            {formatPaiseToRupees(totalRevenuePaise)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Awaiting Settlement</span>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-2">
            {formatPaiseToRupees(pendingSettlementPaise)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Total Invoices</span>
          <p className="text-2xl font-bold text-white font-mono mt-2">{invoices.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Open / Overdue</span>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-2">
            {invoices.filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE').length}
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, customer name, or email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter invoices by status"
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All</option>
              <option value="OPEN" className="bg-slate-900">Open</option>
              <option value="PAID" className="bg-slate-900">Paid</option>
              <option value="OVERDUE" className="bg-slate-900">Overdue</option>
              <option value="VOID" className="bg-slate-900">Void</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice #</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-white text-xs font-medium">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{inv.customerEmail}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(inv.billingPeriod.start).toLocaleDateString()} – {new Date(inv.billingPeriod.end).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-white">
                      {formatPaiseToRupees(inv.totalPaise)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inv.status === 'OPEN'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : inv.status === 'OVERDUE'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleMarkPaid(inv._id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors font-medium"
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleVoid(inv._id)}
                            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
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
