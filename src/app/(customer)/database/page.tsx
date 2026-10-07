import React from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import Link from 'next/link';
import { Plus, Server, ArrowRight } from 'lucide-react';
import { formatPaiseToInr, PLANS } from '@/lib/plans';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';

export const metadata = { title: 'Databases — LioranDB' };

export default async function DatabasePage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const rawInstances = await ManagedDatabase.find({
    $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
    status: { $ne: 'TERMINATED' },
  })
    .sort({ createdAt: -1 })
    .lean();

  const period = getCurrentMonthPeriod();

  const instances = rawInstances.map((inst) => {
    const plan = PLANS[inst.planId] || { name: inst.planId, hourlyRatePaise: inst.hourlyRatePaise || 100 };
    const calc = calculateInstanceUsage(inst as unknown as IManagedDatabase, period);
    return {
      id: inst._id.toString(),
      name: inst.name,
      status: inst.status,
      planName: plan.name,
      hourlyRatePaise: inst.hourlyRatePaise || plan.hourlyRatePaise || 100,
      hourlyRateFormatted: formatPaiseToInr(inst.hourlyRatePaise || plan.hourlyRatePaise || 100) + '/hr',
      backupEnabled: Boolean(inst.backupEnabled),
      host: inst.host,
      port: inst.port,
      databaseName: inst.databaseName,
      estimatedUsageFormatted: formatPaiseToInr(calc.totalPaise),
      billableHours: calc.billableHours.toFixed(1),
      billingStartedAt: inst.billingStartedAt ? new Date(inst.billingStartedAt).toLocaleDateString('en-IN') : null,
      createdAt: inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('en-IN') : '',
    };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Database Instances
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Control plane for your managed LioranDB database instances
          </p>
        </div>
        <Link
          href="/database/create"
          className="inline-flex items-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create Database</span>
        </Link>
      </div>

      {/* Instance Cards / Grid */}
      {instances.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl text-center py-12 space-y-4 border-dashed">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <Server className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">
              No database instances yet
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Get started with an instant postpaid Shared (₹1/hr) or Dedicated (₹8/hr) database cluster.
            </p>
          </div>
          <Link
            href="/database/create"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Database</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <h2 className="font-semibold text-base text-white">{inst.name}</h2>
                    <span className="text-xs text-slate-500 font-mono">{inst.planName}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      inst.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : inst.status === 'SUSPENDED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {inst.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rate:</span>
                    <span className="font-semibold text-white">{inst.hourlyRateFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Month Usage:</span>
                    <span className="font-semibold text-white">
                      {inst.estimatedUsageFormatted} ({inst.billableHours} hrs)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Backups:</span>
                    <span className={inst.backupEnabled ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                      {inst.backupEnabled ? 'Enabled (₹200/mo)' : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Active since: {inst.billingStartedAt || inst.createdAt}
                </span>
                <Link
                  href={`/database/${inst.id}`}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                >
                  <span>Control Plane</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
