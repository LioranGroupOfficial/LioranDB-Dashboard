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
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'PROVISIONING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-spin" />
            PROVISIONING
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            SUSPENDED
          </span>
        );
      case 'RESETTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            RESETTING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            FAILED
          </span>
        );
      case 'TERMINATED':
      case 'DELETED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            {status}
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Managed Databases</h1>
          <p className="text-sm text-slate-400 mt-1">
            Privileged infrastructure control plane for all LioranDB managed database servers.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Managed</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{initialDatabases.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{activeCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suspended</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{suspendedCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Resetting / Terminated</span>
            <AlertCircle className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-400 mt-2">
            {resettingCount + terminatedCount}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by instance name, ID, host, or customer..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter databases by status"
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active</option>
              <option value="PROVISIONING" className="bg-slate-900">Provisioning</option>
              <option value="SUSPENDED" className="bg-slate-900">Suspended</option>
              <option value="RESETTING" className="bg-slate-900">Resetting</option>
              <option value="TERMINATED" className="bg-slate-900">Terminated</option>
              <option value="FAILED" className="bg-slate-900">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
            <span>Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              aria-label="Filter databases by plan"
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Plans</option>
              <option value="shared" className="bg-slate-900">Shared (₹1/hr)</option>
              <option value="dedicated" className="bg-slate-900">Dedicated (₹8/hr)</option>
              <option value="high-capacity" className="bg-slate-900">High Capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Databases Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Database / Instance</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Plan & Rate</th>
                <th className="px-5 py-3 font-medium">Server / Endpoint</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Users</th>
                <th className="px-5 py-3 font-medium">Backups</th>
                <th className="px-5 py-3 font-medium">Billing</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDatabases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">No managed database instances found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredDatabases.map((inst) => {
                  const isBillingActive =
                    (inst.status === 'ACTIVE' || inst.status === 'RUNNING') &&
                    inst.billingStartedAt &&
                    !inst.billingStoppedAt;

                  return (
                    <tr key={inst._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                            <Database className="w-4 h-4" />
                          </div>
                          <div>
                            <Link
                              href={`/admin/databases/${inst._id}`}
                              className="font-medium text-white hover:text-indigo-400 transition-colors block"
                            >
                              {inst.name}
                            </Link>
                            <span className="font-mono text-[11px] text-slate-500">
                              {inst._id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {inst.customer ? (
                          <div>
                            <Link
                              href={`/admin/customers/${inst.customer._id}`}
                              className="text-white hover:text-indigo-400 text-xs font-medium block"
                            >
                              {inst.customer.fullName || inst.customer.email.split('@')[0]}
                            </Link>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[140px]">
                              {inst.customer.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">
                            {inst.planName || (inst.planId === 'dedicated' ? 'Dedicated' : 'Shared')}
                          </span>
                          <span className="text-xs text-slate-400 block mt-1">
                            {formatPaiseToRupees(inst.hourlyRatePaise)}/hr
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-300">
                          {inst.host}:{inst.port}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {renderStatusBadge(inst.status)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Users className="w-3 h-3" />
                          {inst.databaseUsersCount}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {inst.backupEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Disabled
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {isBillingActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Accruing
                          </span>
                        ) : inst.status === 'SUSPENDED' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Paused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Stopped
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/databases/${inst._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
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
