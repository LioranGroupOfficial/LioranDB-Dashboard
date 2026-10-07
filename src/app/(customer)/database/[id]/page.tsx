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

  // Decrypt connection string server-side safely
  let connectionUri: string | null = null;
  if (instance.encryptedConnectionUri) {
    try {
      connectionUri = decrypt(instance.encryptedConnectionUri);
    } catch {
      connectionUri = null;
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

  const users = ((instance.databaseUsers || []) as Array<{ username: string; createdAt?: Date | string }>).map((u) => ({
    username: u.username,
    createdAt: u.createdAt || instance.createdAt,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back Navigation */}
      <div>
        <Link
          href="/database"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Database Instances</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-normal text-white tracking-tight">
                {instance.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono uppercase tracking-wider ${
                  instance.status === 'ACTIVE' || instance.status === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : instance.status === 'PROVISIONING'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : instance.status === 'SUSPENDED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {instance.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {instance.planName || plan?.name || 'Shared'} Plan • {instance.region || 'ap-south-1 (Mumbai)'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://studio.liorandb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Open Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/billing"
              className="py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Billing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Specifications & Usage Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono uppercase tracking-wider mb-1">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hourly Rate</span>
          </div>
          <p className="font-serif text-lg font-medium text-white">
            {formatPaiseToRupees(hourlyRatePaise)}/hr
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Current Usage</span>
          </div>
          <p className="font-serif text-lg font-medium text-white">
            {usageEstimate.billableHours.toFixed(1)} hrs
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono uppercase tracking-wider mb-1">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Estimated Cost</span>
          </div>
          <p className="font-serif text-lg font-medium text-emerald-400">
            {formatPaiseToRupees(usageEstimate.totalPaise)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Managed Backup</span>
          </div>
          <p className="font-serif text-lg font-medium text-white">
            {instance.backupEnabled ? '₹200/mo' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* Applied Discount Coupon Banner */}
      {instance.couponCode && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4" />
            <span>
              Promo discount <strong>{instance.couponDiscountPercentage}% OFF</strong> applied ({instance.couponCode}).
            </span>
          </div>
          <span className="font-mono text-emerald-300">Active</span>
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
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-red-400">
            Danger Zone
          </h2>
          <p className="text-xs text-slate-400">
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
