import { requireRegisteredUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Subscription, Payment } from '@/lib/db';
import Link from 'next/link';
import {
  Server,
  Database,
  CreditCard,
  Plus,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';

export const metadata = {
  title: 'Dashboard Overview — LioranDB',
  description: 'Manage LioranDB database instances, subscriptions, and compute metrics.',
};

export default async function DashboardPage() {
  const sessionUser = await requireRegisteredUser();

  await connectToDatabase();

  const [user, instances, subscriptions, recentPayments] = await Promise.all([
    User.findById(sessionUser.userId).select('-passwordHash').lean(),
    ManagedDatabase.find({
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
      status: { $nin: ['DELETED', 'TERMINATED'] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    Subscription.find({ userId: sessionUser.userId, status: 'ACTIVE' }).lean(),
    Payment.find({ userId: sessionUser.userId, status: 'PAID' })
      .sort({ paidAt: -1 })
      .limit(3)
      .lean(),
  ]);

  // Aggregate Metrics
  const activeInstancesCount = instances.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'RUNNING'
  ).length;

  const backupEnabledCount = instances.filter((i) => i.backupEnabled).length;

  const totalMonthlySpendPaise = instances.reduce((acc, inst) => {
    if (inst.status === 'ACTIVE' || inst.status === 'RUNNING' || inst.status === 'PROVISIONING') {
      const plan = getPlan(inst.planId);
      const instPricePaise = inst.monthlyPricePaise || (plan?.pricePaise || 149900);
      return acc + instPricePaise;
    }
    return acc;
  }, 0);

  const totalDocCapacity = instances.reduce((acc, inst) => {
    const plan = getPlan(inst.planId);
    return acc + (inst.documentLimit || plan?.documentLimit || 100000);
  }, 0);

  const formattedDocCapacity =
    totalDocCapacity >= 1000000
      ? `${(totalDocCapacity / 1000000).toFixed(1)}M docs`
      : totalDocCapacity > 0
      ? `${(totalDocCapacity / 1000).toFixed(0)}K docs`
      : '0 docs';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[11px] font-mono mb-2 border border-[var(--color-primary)]/20">
            <Sparkles className="w-3 h-3" /> Account Active • Registration Verified
          </div>
          <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)] tracking-tight">
            {user?.profile?.fullName ? `Welcome back, ${user.profile.fullName.split(' ')[0]}` : 'Dashboard Overview'}
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            High-performance ACID compliant MongoDB-compatible managed clusters.
          </p>
        </div>

        <Link
          href="/database/create"
          className="inline-flex items-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-xs font-medium transition-all shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Database Instance</span>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-2">
            <span>Active Instances</span>
            <Server className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="font-serif text-3xl font-normal text-[var(--color-text-primary)]">
            {activeInstancesCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            {instances.length} total provisioned
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-2">
            <span>Monthly Spend</span>
            <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="font-serif text-3xl font-normal text-[var(--color-text-primary)]">
            {formatPaiseToRupees(totalMonthlySpendPaise)}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Billed monthly via Razorpay
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-2">
            <span>Document Capacity</span>
            <Database className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="font-serif text-3xl font-normal text-[var(--color-text-primary)]">
            {formattedDocCapacity}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Combined guideline limit
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-2">
            <span>Daily Backups</span>
            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="font-serif text-3xl font-normal text-[var(--color-text-primary)]">
            {backupEnabledCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Instances with snapshot retention
          </p>
        </div>
      </div>

      {/* Recent Instances Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)]">
              Managed Database Instances
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Your active clusters and connection endpoints.
            </p>
          </div>
          {instances.length > 0 && (
            <Link
              href="/database"
              className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all instances</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {instances.length === 0 ? (
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-8 text-center space-y-3">
            <Database className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              No active instances deployed
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              Ready to build? Choose a plan and deploy a dedicated or shared LioranDB cluster in seconds.
            </p>
            <div className="pt-2">
              <Link
                href="/database/create"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-xs font-medium transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Database</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.slice(0, 4).map((inst) => {
              const plan = getPlan(inst.planId);
              return (
                <div
                  key={inst._id.toString()}
                  className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] hover:border-[var(--color-text-tertiary)] rounded-xl p-5 transition-all shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="font-serif text-lg font-medium text-[var(--color-text-primary)] truncate">
                          {inst.name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : inst.status === 'PROVISIONING'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      }`}>
                        {inst.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-4">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
                        {inst.type || plan?.type || 'dedicated'}
                      </span>
                      <span>•</span>
                      <span>{plan?.name || 'Managed Instance'}</span>
                      <span>•</span>
                      <span>{inst.region || 'ap-south-1'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border-subtle)] pt-3">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        <span>{inst.cpu || plan?.cpu || '1 vCPU'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        <span>{plan?.memory || '1 GB RAM'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs">
                    <span className="font-serif font-bold text-[var(--color-text-primary)]">
                      {inst.monthlyPricePaise ? formatPaiseToRupees(inst.monthlyPricePaise) : (plan ? `₹${plan.priceRupees.toLocaleString('en-IN')}/mo` : '₹1,499/mo')}
                    </span>
                    <Link
                      href={`/database/${inst._id.toString()}`}
                      className="py-1.5 px-3 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1.5"
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

      {/* Quick Links & Studio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Billing &amp; Invoices
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Review active subscriptions, Razorpay transactions, and payment methods.
            </p>
          </div>
          <Link
            href="/billing"
            className="py-2 px-3.5 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs font-medium text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1 shrink-0 ml-3"
          >
            <span>Billing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              LioranDB Studio
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Connect to your live collections using the visual query console.
            </p>
          </div>
          <a
            href="https://studio.liorandb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3.5 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs font-medium text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1 shrink-0 ml-3"
          >
            <span>Launch</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
