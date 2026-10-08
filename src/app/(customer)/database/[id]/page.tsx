import React from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Activity,
  ExternalLink,
  ArrowLeft,
  CreditCard,
  Clock,
  Tag,
} from 'lucide-react';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';
import DatabaseCredentials from '@/components/database/DatabaseCredentials';
import DatabaseUsersManager from '@/components/database/DatabaseUsersManager';
import CancelInstanceModal from '@/components/database/CancelInstanceModal';
import { decrypt } from '@/lib/crypto';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';

export const metadata = { title: 'Instance Details — LioranDB' };

export default async function InstanceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireVerifiedUser();
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
  const hourlyRatePaise = instance.hourlyRatePaise || plan?.hourlyRatePaise || 100;
  const couponDiscountPercentage = instance.couponDiscountPercentage || 0;
  const effectiveHourlyRatePaise = Math.round(hourlyRatePaise * (1 - couponDiscountPercentage / 100));

  // Decrypt connection string server-side safely
  let connectionUri: string | null = null;
  if (instance.encryptedConnectionUri) {
    try {
      connectionUri = decrypt(instance.encryptedConnectionUri);
    } catch {
      connectionUri = null;
    }
  }

  // Fallback: If connectionUri has placeholder or missing password, decrypt master password
  if ((!connectionUri || connectionUri.includes('<password>')) && instance.encryptedControlPlaneCredential) {
    try {
      const password = decrypt(instance.encryptedControlPlaneCredential);
      if (password) {
        connectionUri = buildLioranDBConnectionUri({
          username: instance.username || 'admin',
          password,
          host: instance.host,
          port: instance.port || 27018,
          database: instance.databaseName || 'default',
          scheme: instance.port === 443 || instance.port === 8443 ? 'liorandb+https' : 'liorandb',
          tls: instance.port === 443 || instance.port === 8443,
          transport: 'grpc',
        });
      }
    } catch {
      // ignore
    }
  }

  // Calculate current month usage estimate for this instance
  const currentPeriod = getCurrentMonthPeriod();
  const usageEstimate = calculateInstanceUsage(
    instance as unknown as IManagedDatabase,
    currentPeriod
  );

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
    billingStartedAt: instance.billingStartedAt?.toISOString(),
    provisionedAt: instance.provisionedAt?.toISOString(),
  };

  const users = ((instance.databaseUsers || []) as Array<{
    username: string;
    role?: string;
    status?: string;
    encryptedPassword?: string;
    createdAt?: Date | string;
  }>).map((u) => {
    let password = '';
    if (u.encryptedPassword) {
      try {
        password = decrypt(u.encryptedPassword);
      } catch {}
    } else if (u.username === instance.username && instance.encryptedControlPlaneCredential) {
      try {
        password = decrypt(instance.encryptedControlPlaneCredential);
      } catch {}
    }
    return {
      username: u.username,
      role: u.role || 'read_write',
      status: u.status || 'ACTIVE',
      password: password || undefined,
      createdAt: u.createdAt || instance.createdAt,
    };
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back Navigation */}
      <div>
        <Link
          href="/database"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors mb-3 font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Database Instances</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-strong)] tracking-tight">
                {instance.name}
              </h1>
              <span
                className={`badge ${
                  instance.status === 'ACTIVE' || instance.status === 'RUNNING'
                    ? 'badge-active'
                    : instance.status === 'PROVISIONING'
                    ? 'badge-info'
                    : instance.status === 'SUSPENDED'
                    ? 'badge-suspended'
                    : 'badge-default'
                }`}
              >
                {instance.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {instance.planName || plan?.name || 'Shared'} Plan • {instance.region || 'ap-south-1 (Mumbai)'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://studio.liorandb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 px-3.5 min-h-[38px] text-xs inline-flex items-center gap-1.5"
            >
              <span>Open Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/billing"
              className="btn-secondary py-1.5 px-3.5 min-h-[38px] text-xs inline-flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Billing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Specifications & Usage Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-1">
            <CreditCard className="w-3.5 h-3.5 text-[var(--text-strong)]" />
            <span>Hourly Rate</span>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text-strong)]">
            {formatPaiseToRupees(effectiveHourlyRatePaise)}/hr
          </p>
          {couponDiscountPercentage > 0 && (
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
              Base: <span className="line-through">{formatPaiseToRupees(hourlyRatePaise)}/hr</span> (-{couponDiscountPercentage}%)
            </p>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5 text-[var(--text-strong)]" />
            <span>Current Usage</span>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text-strong)]">
            {usageEstimate.billableHours.toFixed(1)} hrs
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-1">
            <Activity className="w-3.5 h-3.5 text-[var(--text-strong)]" />
            <span>Estimated Cost</span>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text-strong)]">
            {formatPaiseToRupees(usageEstimate.totalPaise)}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-mono uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-strong)]" />
            <span>Managed Backup</span>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text-strong)]">
            {instance.backupEnabled ? '₹200/mo' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* Applied Discount Coupon Banner */}
      {instance.couponCode && (
        <div className="p-3.5 rounded-[10px] bg-[var(--surface-card)] border-2 border-[var(--hairline-strong)] text-[var(--text-strong)] text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-[var(--text-strong)]" />
            <span>
              Promo discount <strong>{instance.couponDiscountPercentage}% OFF</strong> applied ({instance.couponCode}).
            </span>
          </div>
          <span className="badge badge-active">Active</span>
        </div>
      )}

      {/* Connection Details Section */}
      <DatabaseCredentials db={dbData} />

      {/* Database Users & Access Manager */}
      <DatabaseUsersManager
        instanceId={instance._id.toString()}
        initialUsers={users}
        instanceStatus={instance.status}
      />

      {/* Danger Zone */}
      {instance.status !== 'TERMINATED' && instance.status !== 'DELETED' && (
        <div className="card border-2 border-[var(--border)] p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-strong)] uppercase tracking-wider">
            Danger Zone
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Terminating this database instance stops hourly usage accumulation and closes the current billing interval. All stored documents will be erased.
          </p>
          <div className="pt-2">
            <CancelInstanceModal
              instanceId={instance._id.toString()}
              instanceName={instance.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
