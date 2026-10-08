import React from 'react';
import { requireAccountVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import CreateDatabaseClient from './CreateDatabaseClient';
import Link from 'next/link';
import { Database, ArrowLeft, ShieldAlert } from 'lucide-react';

export const metadata = { title: 'Create Database Instance — LioranDB' };

export default async function CreateInstancePage() {
  const sessionUser = await requireAccountVerifiedUser();
  await connectToDatabase();

  const MAX_DATABASES = 2;
  const activeDatabasesCount = await ManagedDatabase.countDocuments({
    $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
    status: { $nin: ['TERMINATED', 'DELETED'] },
  });

  const isLimitReached = sessionUser.role !== 'admin' && activeDatabasesCount >= MAX_DATABASES;

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

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <Link
              href="/dashboard"
              className="btn-secondary text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/database"
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Manage Databases ({activeDatabasesCount}/2)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CreateDatabaseClient activeDatabasesCount={activeDatabasesCount} maxLimit={MAX_DATABASES} />;
}
