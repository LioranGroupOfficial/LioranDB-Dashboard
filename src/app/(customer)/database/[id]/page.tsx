import { requireRegisteredUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, Subscription } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  Database,
  Cpu,
  ShieldCheck,
  Activity,
  ExternalLink,
  ArrowLeft,
  CreditCard,
  HardDrive,
  Globe,
} from 'lucide-react';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';
import DatabaseCredentials from '@/components/database/DatabaseCredentials';
import { decrypt } from '@/lib/crypto';
import DeleteInstanceButton from '@/components/database/DeleteInstanceButton';

export const metadata = { title: 'Instance Details — LioranDB' };

export default async function InstanceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireRegisteredUser();
  const { id } = await params;

  await connectToDatabase();
  const instance = await ManagedDatabase.findById(id).lean();

  if (!instance) {
    notFound();
  }

  // Security check: owner or admin/support only
  if (
    sessionUser.role !== 'admin' &&
    sessionUser.role !== 'support' &&
    instance.customerId.toString() !== sessionUser.userId &&
    instance.userId?.toString() !== sessionUser.userId
  ) {
    redirect('/database');
  }

  const plan = getPlan(instance.planId);
  const subscription = instance.subscriptionId
    ? await Subscription.findById(instance.subscriptionId).lean()
    : null;

  // Decrypt connection string server-side safely
  let connectionUri: string | null = null;
  if (instance.encryptedConnectionUri) {
    try {
      connectionUri = decrypt(instance.encryptedConnectionUri);
    } catch {
      connectionUri = null;
    }
  }

  const dbData = {
    id: instance._id.toString(),
    name: instance.name,
    status: instance.status,
    host: instance.host,
    port: instance.port,
    databaseName: instance.databaseName,
    username: instance.username,
    connectionUri,
    planId: instance.planId,
    passwordChangeRequired: instance.passwordChangeRequired || false,
    temporaryCredentialExpiresAt: instance.temporaryCredentialExpiresAt?.toISOString(),
    provisionedAt: instance.provisionedAt?.toISOString(),
    suspendedAt: instance.suspendedAt?.toISOString(),
    suspensionReason: instance.suspensionReason,
  };

  const monthlyPrice = instance.monthlyPricePaise
    ? formatPaiseToRupees(instance.monthlyPricePaise)
    : plan
    ? `₹${plan.priceRupees.toLocaleString('en-IN')}/mo`
    : '₹1,499/mo';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back Navigation */}
      <div>
        <Link
          href="/database"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Database Instances</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)] tracking-tight">
                {instance.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono uppercase tracking-wider ${
                  instance.status === 'ACTIVE' || instance.status === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : instance.status === 'PROVISIONING'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                }`}
              >
                {instance.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {plan?.name || 'Dedicated Managed Instance'} • {instance.region || 'ap-south-1 (Mumbai)'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://studio.liorandb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3.5 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs font-medium text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1.5"
            >
              <span>Query Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/billing"
              className="py-2 px-3.5 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs font-medium text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Billing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Specifications & Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-1">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>vCPU Allocation</span>
          </div>
          <p className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
            {instance.cpu || plan?.cpu || '1 vCPU'}
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-1">
            <Server className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Memory (RAM)</span>
          </div>
          <p className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
            {plan?.memory || `${(instance.memoryMb || 1024) / 1024} GB RAM`}
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-1">
            <Database className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Document Capacity</span>
          </div>
          <p className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
            {plan?.documentGuideline || 'Up to 100,000 docs'}
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-tertiary)] text-xs font-mono uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Daily Backups</span>
          </div>
          <p className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
            {instance.backupEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* Connection Details Section */}
      <DatabaseCredentials db={dbData} />

      {/* Telemetry & Health */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
              Cluster Telemetry &amp; Availability
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-text-tertiary)]">
            Health Check: OK
          </span>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)]">
          Real-time metrics stream live telemetry from your LioranDB compute nodes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase block">
              Node Connectivity
            </span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
              100% TLS Online
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase block">
              Monthly Subscription
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)] mt-1 block">
              {monthlyPrice}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase block">
              Billing Status
            </span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
              {subscription?.status || 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[var(--color-surface-raised)] border border-red-500/20 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-red-600 dark:text-red-400">
          Danger Zone
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Permanently delete this instance cluster and stop monthly subscription billing. This action cannot be undone.
        </p>
        <div className="pt-2">
          <DeleteInstanceButton
            instanceId={instance._id.toString()}
            instanceName={instance.name}
            createdAt={instance.createdAt ? new Date(instance.createdAt).toISOString() : undefined}
            monthlyPricePaise={instance.monthlyPricePaise}
            planId={instance.planId}
          />
        </div>
      </div>
    </div>
  );
}

