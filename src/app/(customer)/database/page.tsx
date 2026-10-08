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
    const baseHourlyRatePaise = inst.hourlyRatePaise || plan.hourlyRatePaise || 100;
    const couponDiscountPercentage = inst.couponDiscountPercentage || 0;
    const effectiveHourlyRatePaise = calc.effectiveHourlyRatePaise;

    return {
      id: inst._id.toString(),
      name: inst.name,
      status: inst.status,
      planName: plan.name,
      hourlyRatePaise: baseHourlyRatePaise,
      effectiveHourlyRatePaise,
      couponDiscountPercentage,
      couponCode: inst.couponCode,
      hourlyRateFormatted: formatPaiseToInr(effectiveHourlyRatePaise) + '/hr',
      baseHourlyRateFormatted: formatPaiseToInr(baseHourlyRatePaise) + '/hr',
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
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">
            Database Instances
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Control plane for your managed LioranDB database instances
          </p>
        </div>
        <div className="flex items-center gap-2">
          {instances.length < 2 ? (
            <Link
              href="/database/create"
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Create Database ({instances.length}/2)</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-xs font-mono font-medium bg-[var(--surface-soft)] text-[var(--text-muted)] border border-[var(--border)]">
              Limit Reached (2/2)
            </span>
          )}
        </div>
      </div>

      {/* Instance Cards / Grid */}
      {instances.length === 0 ? (
        <div className="card text-center py-12 space-y-4 border-dashed">
          <div className="w-12 h-12 rounded-[10px] bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] flex items-center justify-center mx-auto">
            <Server className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--text-strong)]">
              No database instances yet
            </h2>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Get started with an instant postpaid Shared (₹1/hr) or Dedicated on-demand database cluster.
            </p>
          </div>
          <Link
            href="/database/create"
            className="btn-primary inline-flex"
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
              className="card p-5 space-y-4 hover:border-[var(--hairline-strong)] transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <h2 className="font-bold text-base text-[var(--text-strong)]">{inst.name}</h2>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{inst.planName}</span>
                  </div>
                  <span
                    className={`badge ${
                      inst.status === 'ACTIVE'
                        ? 'badge-active'
                        : inst.status === 'SUSPENDED'
                        ? 'badge-suspended'
                        : 'badge-info'
                    }`}
                  >
                    {inst.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-[var(--surface-soft)] p-3 rounded-[7px] border border-[var(--border)] font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)]">Rate:</span>
                    <div className="text-right">
                      {inst.couponDiscountPercentage > 0 ? (
                        <div>
                          <span className="font-semibold text-[var(--text-strong)]">{inst.hourlyRateFormatted}</span>
                          <span className="text-[10px] text-[var(--text-muted)] line-through ml-1.5 font-normal">
                            {inst.baseHourlyRateFormatted}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[var(--text-strong)]">{inst.hourlyRateFormatted}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Month Usage:</span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {inst.estimatedUsageFormatted} ({inst.billableHours} hrs)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Backups:</span>
                    <span className={inst.backupEnabled ? 'text-[var(--text-strong)] font-semibold' : 'text-[var(--text-muted)]'}>
                      {inst.backupEnabled ? 'Enabled (₹200/mo)' : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Active since: {inst.billingStartedAt || inst.createdAt}
                </span>
                <Link
                  href={`/database/${inst.id}`}
                  className="btn-secondary py-1 px-3 min-h-[34px] text-xs inline-flex items-center gap-1.5"
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
