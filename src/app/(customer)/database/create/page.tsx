import React from 'react';
import { requireAccountVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, HostingNode } from '@/lib/db';
import { reconcileHostingNodes } from '@/lib/providers/reconciliation';
import CreateDatabaseClient from './CreateDatabaseClient';
import Link from 'next/link';
import { Database, ArrowLeft, ShieldAlert, Mail, Server } from 'lucide-react';
import { SUPPORT_CONTACT_EMAIL } from '@/lib/plans';

export const metadata = { title: 'Create Database Instance — LioranDB' };

export default async function CreateInstancePage() {
  const sessionUser = await requireAccountVerifiedUser();
  await connectToDatabase();
  await reconcileHostingNodes();

  const MAX_DATABASES = 2;
  const [activeDatabasesCount, allActiveHostingNodes, occupiedNodes] = await Promise.all([
    ManagedDatabase.countDocuments({
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
      status: { $nin: ['TERMINATED', 'DELETED'] },
    }),
    HostingNode.find({ status: { $in: ['AVAILABLE', 'ACTIVE'] } }).lean(),
    ManagedDatabase.find({
      status: { $nin: ['TERMINATED', 'DELETED'] },
      hostingNodeId: { $exists: true, $ne: null },
    })
      .select('hostingNodeId')
      .lean(),
  ]);

  const occupiedNodeIds = new Set(occupiedNodes.map((d) => d.hostingNodeId?.toString()));
  const availableUnassignedNodes = allActiveHostingNodes.filter((n) => !occupiedNodeIds.has(n._id.toString()));

  const isLimitReached = sessionUser.role !== 'admin' && activeDatabasesCount >= MAX_DATABASES;

  // 1. Check if user already reached their 2-database limit
  if (isLimitReached) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--surface-soft)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[var(--text-strong)]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--text-strong)]">
                Database Limit Reached (2/2)
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Your account currently has <strong className="text-[var(--text-strong)]">{activeDatabasesCount} active database instances</strong>. Each account is limited to a maximum of <strong>2 databases</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
            <p className="font-semibold text-[var(--text-strong)]">How to deploy another database?</p>
            <p className="text-[var(--text-muted)]">
              To create a new database cluster, terminate or delete one of your existing database instances from the database control plane first.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[var(--border)]">
            <Link
              href="/dashboard"
              className="btn-secondary text-xs py-2.5 sm:py-2 px-3.5 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/database"
              className="btn-primary text-xs py-2.5 sm:py-2 px-4 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>Manage Databases ({activeDatabasesCount}/2)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Check if 0 dedicated hosting servers are available
  if (availableUnassignedNodes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6 px-3 sm:px-0">
        <div className="card p-5 sm:p-8 space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--surface-soft)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-[var(--text-strong)]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--text-strong)]">
                Dedicated Hosting Servers Occupied
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                All dedicated database hosting servers are currently allocated. In our 1-server-per-database architecture, each database is hosted on its own dedicated server node.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
            <p className="font-semibold text-[var(--text-strong)]">Request a Dedicated Server:</p>
            <p>
              Please mail <strong className="text-[var(--text-strong)] font-mono break-all">{SUPPORT_CONTACT_EMAIL}</strong> to provision and bring a new dedicated hosting server online for your account.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[var(--border)]">
            <Link
              href="/dashboard"
              className="btn-secondary text-xs py-2.5 sm:py-2 px-3.5 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back to Dashboard</span>
            </Link>

            <a
              href={`mailto:${SUPPORT_CONTACT_EMAIL}?subject=Dedicated%20Database%20Server%20Allocation%20Request`}
              className="btn-primary text-xs py-2.5 sm:py-2 px-4 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Mail {SUPPORT_CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CreateDatabaseClient
      activeDatabasesCount={activeDatabasesCount}
      maxLimit={MAX_DATABASES}
    />
  );
}
