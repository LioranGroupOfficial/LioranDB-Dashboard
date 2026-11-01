import Link from 'next/link';
import { ArrowRight, Database, Plus } from 'lucide-react';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import { formatPaiseToInr, getPlan } from '@/lib/plans';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';
import { getSharedRecordLogicalDatabaseName } from '@/lib/liorandb-admin/shared-hosting';
import { ErrorWidget } from '@/components/dashboard/skeletons';

export default async function DatabaseListData({ userId }: { userId: string }) {
  try {
    await connectToDatabase();
    const instances = await ManagedDatabase.find({
      $or: [{ customerId: userId }, { userId }],
      status: { $ne: 'TERMINATED' },
    }).sort({ createdAt: -1 }).lean();
    const period = getCurrentMonthPeriod();

    return (
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] font-mono uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Database</th>
                <th className="px-4 py-3 font-medium">Deployment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Database className="mx-auto mb-2 h-8 w-8 text-[var(--text-strong)]" />
                    <p className="text-sm font-semibold text-[var(--text-strong)]">No databases available</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Create a Free Shared database to get started.</p>
                    <Link href="/database/create" className="btn-primary mt-4 inline-flex text-xs">
                      <Plus className="h-3.5 w-3.5" />Create Database
                    </Link>
                  </td>
                </tr>
              ) : instances.map((instance) => {
                const plan = getPlan(instance.planId);
                const calc = calculateInstanceUsage(instance as unknown as IManagedDatabase, period);
                const shared = instance.type === 'shared' || instance.planId === 'free';
                const displayedDatabaseName = shared
                  ? getSharedRecordLogicalDatabaseName(instance)
                  : instance.databaseName;
                return (
                  <tr key={instance._id.toString()} className="hover:bg-[var(--surface-soft)]">
                    <td className="px-4 py-4">
                      <Link href={`/database/${instance._id.toString()}`} className="font-semibold text-[var(--text-strong)] hover:underline">{instance.name}</Link>
                      <span className="mt-1 block font-mono text-[11px] text-[var(--text-muted)]">{displayedDatabaseName}</span>
                    </td>
                    <td className="px-4 py-4"><span className="badge badge-default">{shared ? 'FREE SHARED' : instance.planName || plan?.name || 'Dedicated'}</span></td>
                    <td className="px-4 py-4"><span className="badge badge-default">{instance.status}</span></td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--text-secondary)]">{instance.host}:{instance.port}</td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--text-secondary)]">{shared ? '512 MiB quota' : formatPaiseToInr(calc.totalPaise)}</td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/database/${instance._id.toString()}`} className="btn-secondary inline-flex min-h-[32px] gap-1 px-2.5 py-1 text-xs">
                        Manage <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch {
    return <ErrorWidget message="Database information is temporarily unavailable." />;
  }
}
