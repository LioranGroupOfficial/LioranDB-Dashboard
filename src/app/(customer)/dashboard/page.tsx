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
          <h1 className="font-serif text-3xl font-normal text-white tracking-tight">
            {user?.profile?.fullName ? `Welcome back, ${user.profile.fullName.split(' ')[0]}` : 'Dashboard Overview'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Self-service usage-based managed databases. Billed hourly, invoiced monthly.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/database/create"
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Database</span>
          </Link>
          <a
            href="https://studio.liorandb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <span>Open Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Unpaid Invoices Alert Banner */}
      {unpaidInvoices.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="text-xs font-semibold text-amber-300">
                You have {unpaidInvoices.length} unpaid invoice(s)
              </h4>
              <p className="text-xs text-amber-400/90 mt-0.5">
                Total outstanding: <strong>{formatPaiseToRupees(unpaidInvoices.reduce((acc, i) => acc + (i.totalPaise || 0), 0))}</strong>
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-all shadow-sm shrink-0 self-start sm:self-auto"
          >
            View &amp; Pay Invoices →
          </Link>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span>Active Instances</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-serif text-3xl font-normal text-white">
            {activeInstancesCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {instances.length} total provisioned
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span>Current Month (Est.)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-serif text-3xl font-normal text-emerald-400">
            {formatPaiseToRupees(estimate.totalEstimatedPaise)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Usage accumulated this month
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span>Unpaid Invoices</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`font-serif text-3xl font-normal ${unpaidInvoices.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {unpaidInvoices.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Monthly billing cycles
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span>Managed Backups</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-serif text-3xl font-normal text-white">
            {backupEnabledCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Protected database clusters
          </p>
        </div>
      </div>

      {/* Instances Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-normal text-white">
            Your Database Instances
          </h2>
          {instances.length > 0 && (
            <Link
              href="/database"
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all instances</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {instances.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Database className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-medium text-white">
              No database instances deployed yet
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Launch a Shared (₹1/hr) or Dedicated (₹8/hr) database instance in seconds. No upfront payment required.
            </p>
            <div className="pt-2">
              <Link
                href="/database/create"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
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
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <h3 className="font-serif text-lg font-medium text-white truncate">
                          {inst.name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider shrink-0 ${
                        inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : inst.status === 'PROVISIONING'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {inst.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {inst.planName || plan?.name || 'Shared'}
                      </span>
                      <span>•</span>
                      <span>{formatPaiseToRupees(ratePaise)}/hr</span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Backups:</span>
                        <span>{inst.backupEnabled ? 'Enabled (₹200/mo)' : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Endpoint:</span>
                        <span className="font-mono truncate ml-2">{inst.host}:{inst.port}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                    <span className="text-slate-500 text-[11px]">
                      Created: {new Date(inst.createdAt).toLocaleDateString('en-IN')}
                    </span>
                    <Link
                      href={`/database/${inst._id.toString()}`}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition-colors inline-flex items-center gap-1.5"
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
