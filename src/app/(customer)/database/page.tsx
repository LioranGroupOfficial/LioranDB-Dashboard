import { requireRegisteredUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import Link from 'next/link';
import { Plus, Database, Server, Cpu, ShieldCheck, ArrowRight, Activity, ExternalLink, HardDrive } from 'lucide-react';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';

export const metadata = { title: 'Managed Databases — LioranDB' };

export default async function DatabasePage() {
  const sessionUser = await requireRegisteredUser();

  await connectToDatabase();
  const rawInstances = await ManagedDatabase.find({
    $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
    status: { $nin: ['DELETED', 'TERMINATED'] },
  })
    .sort({ createdAt: -1 })
    .lean();

  const instances = rawInstances.map((inst) => {
    const plan = getPlan(inst.planId);
    return {
      id: inst._id.toString(),
      name: inst.name,
      slug: inst.slug,
      status: inst.status,
      type: inst.type || plan?.type || 'dedicated',
      planName: plan?.name || 'Managed Instance',
      region: inst.region || 'ap-south-1 (Mumbai)',
      cpu: inst.cpu || plan?.cpu || '1 vCPU',
      memory: plan?.memory || `${(inst.memoryMb || 1024) / 1024} GB RAM`,
      documentGuideline: plan?.documentGuideline || 'Up to 100,000 documents',
      backupEnabled: inst.backupEnabled ?? false,
      monthlyPrice: inst.monthlyPricePaise ? formatPaiseToRupees(inst.monthlyPricePaise) : (plan ? `₹${plan.priceRupees.toLocaleString('en-IN')}/mo` : '₹1,499/mo'),
      createdAt: inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('en-IN') : '',
    };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)] tracking-tight">
            Managed Database Instances
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

      {/* Instance List or Empty State */}
      {instances.length === 0 ? (
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] mx-auto flex items-center justify-center border border-[var(--color-primary)]/20">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)]">
              No database instances yet
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 max-w-sm mx-auto">
              Deploy your first LioranDB managed cluster with automated backups, high availability, and SSL encryption.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/database/create"
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-xs font-medium transition-all shadow-xs"
            >
              <span>Deploy First Instance</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] hover:border-[var(--color-text-tertiary)] rounded-xl p-5 transition-all shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h2 className="font-serif text-lg font-medium text-[var(--color-text-primary)] truncate">
                      {inst.name}
                    </h2>
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
                    {inst.type}
                  </span>
                  <span>•</span>
                  <span>{inst.planName}</span>
                  <span>•</span>
                  <span>{inst.region}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border-subtle)] pt-3">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>{inst.cpu}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>{inst.memory}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>{inst.documentGuideline}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>{inst.backupEnabled ? 'Daily Backup Active' : 'No Backup'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] block">Monthly Rate</span>
                  <span className="font-serif font-bold text-[var(--color-text-primary)]">
                    {inst.monthlyPrice}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/database/${inst.id}`}
                    className="py-1.5 px-3 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Access Card */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[var(--color-primary)]" />
            LioranDB Studio &amp; Query Console
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Connect to your multi-model database using the visual query workspace.
          </p>
        </div>
        <a
          href="https://studio.liorandb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-4 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs font-medium text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <span>Launch Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
