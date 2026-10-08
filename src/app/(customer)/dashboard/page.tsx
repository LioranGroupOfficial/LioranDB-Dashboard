import React from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Invoice } from '@/lib/db';
import Link from 'next/link';
import {
  Server,
  Database,
  Receipt,
  Plus,
  ArrowRight,
  ShieldCheck,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';
import { getCustomerMonthEstimate } from '@/lib/billing';

export const metadata = {
  title: 'Dashboard Overview — LioranDB',
  description: 'Manage LioranDB managed database instances and usage billing.',
};

export default async function DashboardPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const [user, instances, unpaidInvoices, estimate] = await Promise.all([
    User.findById(sessionUser.userId).select('-passwordHash').lean(),
    ManagedDatabase.find({
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
      status: { $nin: ['DELETED', 'TERMINATED'] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    Invoice.find({
      customerId: sessionUser.userId,
      status: { $in: ['OPEN', 'OVERDUE'] },
    }).lean(),
    getCustomerMonthEstimate(sessionUser.userId),
  ]);

  const activeInstancesCount = instances.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'RUNNING'
  ).length;

  const backupEnabledCount = instances.filter((i) => i.backupEnabled).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] tracking-tight">
            {user?.profile?.fullName ? `Welcome back, ${user.profile.fullName.split(' ')[0]}` : 'Dashboard Overview'}
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Self-service usage-based managed databases. Billed hourly, invoiced monthly.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/database/create"
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Database</span>
          </Link>
          <a
            href="https://studio.liorandb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <span>Open Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Unpaid Invoices Alert Banner */}
      {unpaidInvoices.length > 0 && (
        <div className="p-4 rounded-[10px] bg-[var(--surface-card)] border-2 border-[var(--hairline-strong)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--text-strong)] shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-strong)]">
                You have {unpaidInvoices.length} unpaid invoice(s)
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Total outstanding: <strong>{formatPaiseToRupees(unpaidInvoices.reduce((acc, i) => acc + (i.totalPaise || 0), 0))}</strong>
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="btn-primary py-1.5 px-3 min-h-[36px] text-xs shrink-0 self-start sm:self-auto"
          >
            View &amp; Pay Invoices →
          </Link>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-2">
            <span>Active Instances</span>
            <Server className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] font-mono">
            {activeInstancesCount}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {instances.length} total provisioned
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-2">
            <span>Current Month (Est.)</span>
            <Activity className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] font-mono">
            {formatPaiseToRupees(estimate.totalEstimatedPaise)}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Usage accumulated this month
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-2">
            <span>Unpaid Invoices</span>
            <Receipt className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] font-mono">
            {unpaidInvoices.length}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Monthly billing cycles
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-2">
            <span>Managed Backups</span>
            <ShieldCheck className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] font-mono">
            {backupEnabledCount}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Protected database clusters
          </p>
        </div>
      </div>

      {/* Instances Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-strong)]">
            Your Database Instances
          </h2>
          {instances.length > 0 && (
            <Link
              href="/database"
              className="text-xs text-[var(--text-strong)] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View all instances</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {instances.length === 0 ? (
          <div className="card p-8 sm:p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-[10px] bg-[var(--surface-soft)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-strong)]">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-strong)]">
              No database instances deployed yet
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
              Launch a Shared (₹1/hr) or Dedicated on-demand database instance in seconds. No upfront payment required.
            </p>
            <div className="pt-3">
              <Link
                href="/database/create"
                className="btn-primary inline-flex"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Database</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.slice(0, 6).map((inst) => {
              const plan = getPlan(inst.planId);
              const ratePaise = inst.hourlyRatePaise || plan?.hourlyRatePaise || 100;
              return (
                <div
                  key={inst._id.toString()}
                  className="card p-5 hover:border-[var(--hairline-strong)] transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--text-strong)] truncate">
                          {inst.name}
                        </h3>
                      </div>
                      <span className={`badge ${
                        inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                          ? 'badge-active'
                          : inst.status === 'PROVISIONING'
                          ? 'badge-info'
                          : 'badge-default'
                      }`}>
                        {inst.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-secondary)] font-semibold">
                        {inst.planName || plan?.name || 'Shared'}
                      </span>
                      <span>•</span>
                      <span className="font-mono font-medium text-[var(--text-secondary)]">{formatPaiseToRupees(ratePaise)}/hr</span>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] space-y-1.5 border-t border-[var(--border)] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Backups:</span>
                        <span className="font-medium">{inst.backupEnabled ? 'Enabled (₹200/mo)' : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)]">Endpoint:</span>
                        <span className="font-mono truncate ml-2 text-[11px] bg-[var(--surface-soft)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border)]">{inst.host}:{inst.port}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs">
                    <span className="text-[var(--text-muted)] text-[11px] font-mono">
                      {new Date(inst.createdAt).toLocaleDateString('en-IN')}
                    </span>
                    <Link
                      href={`/database/${inst._id.toString()}`}
                      className="btn-secondary py-1 px-3 min-h-[34px] text-xs inline-flex items-center gap-1.5"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
