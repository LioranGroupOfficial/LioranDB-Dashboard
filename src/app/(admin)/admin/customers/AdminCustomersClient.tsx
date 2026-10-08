'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Database, ArrowUpRight, Search, ShieldCheck, CreditCard, Filter } from 'lucide-react';
import type { IAccountVerification } from '@/lib/db/models/User';

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  accountVerification: IAccountVerification;
  accountRegistrationPaid?: boolean;
  activeInstancesCount: number;
  createdAt: string;
}

interface Props {
  customers: CustomerListItem[];
}

type FilterStatus = 'ALL' | 'VERIFIED' | 'UNPAID' | 'PENDING' | 'FAILED';

export default function AdminCustomersClient({ customers }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      // 1. Search filter
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.accountVerification?.razorpayOrderId && c.accountVerification.razorpayOrderId.toLowerCase().includes(search.toLowerCase())) ||
        (c.accountVerification?.razorpayPaymentId && c.accountVerification.razorpayPaymentId.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Status filter
      const isPaid = c.accountVerification?.feePaid || c.accountRegistrationPaid;
      const status: string = c.accountVerification?.status || (isPaid ? 'VERIFIED' : 'UNPAID');

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'VERIFIED') return isPaid || status === 'VERIFIED';
      if (statusFilter === 'UNPAID') return !isPaid && (status === 'UNPAID' || !status);
      if (statusFilter === 'PENDING') return status === 'PENDING';

      return true;
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const verified = customers.filter((c) => c.accountVerification?.feePaid || c.accountRegistrationPaid).length;
    const unpaid = customers.filter((c) => !(c.accountVerification?.feePaid || c.accountRegistrationPaid) && c.accountVerification?.status !== 'PENDING').length;
    const pending = customers.filter((c) => c.accountVerification?.status === 'PENDING').length;
    return { total, verified, unpaid, pending };
  }, [customers]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Customer Accounts</h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Privileged customer management, ₹30 account verification tracking, and database fleet visibility.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Total Customers</span>
          <p className="text-xl font-bold text-[var(--text-strong)] font-mono mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">₹30 Verified</span>
          <p className="text-xl font-bold text-[var(--text-strong)] font-mono mt-1">{stats.verified}</p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Unpaid Verification</span>
          <p className="text-xl font-bold text-[var(--text-strong)] font-mono mt-1">{stats.unpaid}</p>
        </div>
        <div className="card p-4">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Pending Order</span>
          <p className="text-xl font-bold text-[var(--text-strong)] font-mono mt-1">{stats.pending}</p>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or Razorpay ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 w-full"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </span>
          {(['ALL', 'VERIFIED', 'UNPAID', 'PENDING', 'FAILED'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1 rounded-[5px] text-xs font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer border ${
                statusFilter === f
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-strong)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Email Verification</th>
                <th className="px-4 py-3 font-medium">₹30 Fee Status</th>
                <th className="px-4 py-3 font-medium">Active Instances</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {filtered.map((u) => {
                const isPaid = u.accountVerification?.feePaid || u.accountRegistrationPaid;
                return (
                  <tr key={u.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[var(--text-strong)] text-sm font-sans">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`badge ${
                          u.emailVerified
                            ? 'badge-active'
                            : 'badge-default'
                        }`}
                      >
                        {u.emailVerified ? 'Verified' : 'Pending OTP'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <span
                          className={`badge ${
                            isPaid
                              ? 'badge-active'
                              : u.accountVerification?.status === 'PENDING'
                              ? 'badge-info'
                              : 'badge-default'
                          }`}
                        >
                          {isPaid ? 'PAID (₹30)' : u.accountVerification?.status || 'UNPAID'}
                        </span>
                        {u.accountVerification?.paidAt && (
                          <span className="block text-[10px] text-[var(--text-muted)] font-mono">
                            {new Date(u.accountVerification.paidAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-strong)] font-bold">
                      <span className="inline-flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>{u.activeInstancesCount}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/customers/${u.id}`}
                        className="btn-secondary py-1 px-2.5 min-h-[30px] text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Manage</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-[var(--text-muted)] font-sans">
                    No customers match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
