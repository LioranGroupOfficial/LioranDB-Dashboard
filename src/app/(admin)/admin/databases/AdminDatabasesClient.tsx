'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Database,
  Search,
  Server,
  Clock,
  AlertCircle,
  Users,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  Filter,
  Tag,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

export interface AdminDatabaseItem {
  _id: string;
  name: string;
  host: string;
  port: number;
  status: string;
  planId: string;
  planName?: string;
  hourlyRatePaise: number;
  backupEnabled: boolean;
  backupMonthlyPaise: number;
  couponCode?: string | null;
  couponDiscountPercentage?: number;
  billingStartedAt?: string | null;
  billingStoppedAt?: string | null;
  databaseUsersCount: number;
  customer?: {
    _id: string;
    email: string;
    fullName?: string;
  } | null;
  createdAt: string;
}

interface Props {
  initialDatabases: AdminDatabaseItem[];
}

export default function AdminDatabasesClient({ initialDatabases }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');

  const filteredDatabases = useMemo(() => {
    return initialDatabases.filter((inst) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inst.name.toLowerCase().includes(q) ||
        inst._id.toLowerCase().includes(q) ||
        inst.host.toLowerCase().includes(q) ||
        inst.couponCode?.toLowerCase().includes(q) ||
        inst.customer?.email.toLowerCase().includes(q) ||
        inst.customer?.fullName?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        inst.status === statusFilter ||
        (statusFilter === 'ACTIVE' && (inst.status === 'ACTIVE' || inst.status === 'RUNNING'));

      const matchesPlan =
        planFilter === 'ALL' || inst.planId === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [initialDatabases, search, statusFilter, planFilter]);

  const activeCount = initialDatabases.filter((i) => i.status === 'ACTIVE' || i.status === 'RUNNING').length;
  const suspendedCount = initialDatabases.filter((i) => i.status === 'SUSPENDED').length;
  const resettingCount = initialDatabases.filter((i) => i.status === 'RESETTING').length;
  const terminatedCount = initialDatabases.filter((i) => i.status === 'TERMINATED' || i.status === 'DELETED').length;

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'ACTIVE':
      case 'RUNNING':
        return <span className="badge badge-active">ACTIVE</span>;
      case 'PROVISIONING':
        return <span className="badge badge-info">PROVISIONING</span>;
      case 'SUSPENDED':
        return <span className="badge badge-suspended">SUSPENDED</span>;
      case 'RESETTING':
        return <span className="badge badge-info">RESETTING</span>;
      case 'FAILED':
        return <span className="badge badge-default">FAILED</span>;
      case 'TERMINATED':
      case 'DELETED':
      default:
        return <span className="badge badge-default">{status}</span>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Managed Databases</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Privileged infrastructure control plane for all LioranDB managed database servers.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Total Managed</span>
            <Server className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{initialDatabases.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Active</span>
            <Database className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{activeCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Suspended</span>
            <Clock className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{suspendedCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Resetting / Terminated</span>
            <AlertCircle className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {resettingCount + terminatedCount}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by instance name, ID, host, or customer..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] text-xs text-[var(--text-secondary)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter databases by status"
              className="bg-transparent text-[var(--text-strong)] focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-[var(--surface)] text-[var(--text-primary)]">All Statuses</option>
              <option value="ACTIVE" className="bg-[var(--surface)] text-[var(--text-primary)]">Active</option>
              <option value="PROVISIONING" className="bg-[var(--surface)] text-[var(--text-primary)]">Provisioning</option>
              <option value="SUSPENDED" className="bg-[var(--surface)] text-[var(--text-primary)]">Suspended</option>
              <option value="RESETTING" className="bg-[var(--surface)] text-[var(--text-primary)]">Resetting</option>
              <option value="TERMINATED" className="bg-[var(--surface)] text-[var(--text-primary)]">Terminated</option>
              <option value="FAILED" className="bg-[var(--surface)] text-[var(--text-primary)]">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] text-xs text-[var(--text-secondary)]">
            <span className="font-mono text-[11px]">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              aria-label="Filter databases by plan"
              className="bg-transparent text-[var(--text-strong)] focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-[var(--surface)] text-[var(--text-primary)]">All Plans</option>
              <option value="shared" className="bg-[var(--surface)] text-[var(--text-primary)]">Shared (₹1/hr)</option>
              <option value="dedicated" className="bg-[var(--surface)] text-[var(--text-primary)]">Dedicated</option>
              <option value="high-capacity" className="bg-[var(--surface)] text-[var(--text-primary)]">High Capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Databases Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Database / Instance</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan &amp; Rate</th>
                <th className="px-4 py-3 font-medium">Server / Endpoint</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Backups</th>
                <th className="px-4 py-3 font-medium">Billing</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {filteredDatabases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[var(--muted)]">
                    <Database className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" />
                    <p className="text-sm font-sans">No managed database instances found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredDatabases.map((inst) => {
                  const isBillingActive =
                    (inst.status === 'ACTIVE' || inst.status === 'RUNNING') &&
                    inst.billingStartedAt &&
                    !inst.billingStoppedAt;

                  return (
                    <tr key={inst._id} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-[6px] bg-[var(--surface-soft)] border border-[var(--border)] flex items-center justify-center text-[var(--text-strong)] shrink-0">
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <Link
                              href={`/admin/databases/${inst._id}`}
                              className="font-bold font-sans text-sm text-[var(--text-strong)] hover:underline block"
                            >
                              {inst.name}
                            </Link>
                            <span className="font-mono text-[11px] text-[var(--muted)]">
                              {inst._id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {inst.customer ? (
                          <div>
                            <Link
                              href={`/admin/customers/${inst.customer._id}`}
                              className="text-[var(--text-strong)] hover:underline text-xs font-semibold block font-sans"
                            >
                              {inst.customer.fullName || inst.customer.email.split('@')[0]}
                            </Link>
                            <span className="text-[11px] text-[var(--muted)] block truncate max-w-[140px]">
                              {inst.customer.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)] font-semibold">
                              {inst.planName || (inst.planId === 'dedicated' ? 'Dedicated' : 'Shared')}
                            </span>
                            {inst.couponDiscountPercentage && inst.couponDiscountPercentage > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-strong)] font-semibold">
                                <Tag className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                <span>{inst.couponCode ? `${inst.couponCode} ` : ''}({inst.couponDiscountPercentage}% OFF)</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1">
                            {inst.couponDiscountPercentage && inst.couponDiscountPercentage > 0 ? (
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span className="font-bold text-[var(--text-strong)]">
                                  {formatPaiseToRupees(Math.round(inst.hourlyRatePaise * (1 - inst.couponDiscountPercentage / 100)))}/hr
                                </span>
                                <span className="line-through text-[var(--text-muted)] text-[11px]">
                                  {formatPaiseToRupees(inst.hourlyRatePaise)}/hr
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)] block font-mono">
                                {formatPaiseToRupees(inst.hourlyRatePaise)}/hr
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {inst.host}:{inst.port}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`badge ${
                          inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                            ? 'badge-active'
                            : inst.status === 'PROVISIONING'
                            ? 'badge-info'
                            : inst.status === 'SUSPENDED'
                            ? 'badge-suspended'
                            : 'badge-default'
                        }`}>
                          {inst.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Users className="w-3.5 h-3.5 text-[var(--muted)]" />
                          {inst.databaseUsersCount}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {inst.backupEnabled ? (
                          <span className="badge badge-active text-[10px]">
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-default text-[10px]">
                            Disabled
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isBillingActive ? (
                          <span className="badge badge-active text-[10px]">
                            Accruing
                          </span>
                        ) : inst.status === 'SUSPENDED' ? (
                          <span className="badge badge-suspended text-[10px]">
                            Paused
                          </span>
                        ) : (
                          <span className="badge badge-default text-[10px]">
                            Stopped
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/databases/${inst._id}`}
                          className="btn-secondary py-1 px-2.5 min-h-[30px] text-xs inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
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
  );
}
