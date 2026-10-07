import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Activity, Server, Info } from 'lucide-react';
import { getCustomerMonthEstimate } from '@/lib/billing';
import { formatPaiseToRupees } from '@/lib/plans';
import Link from 'next/link';

export const metadata = { title: 'Usage & Hours — LioranDB' };

export default async function UsagePage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const user = await User.findById(sessionUser.userId).lean();
  if (!user) redirect('/login');

  const estimate = await getCustomerMonthEstimate(user._id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-normal text-[var(--text-primary)] tracking-tight">
            Usage &amp; Hours
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Hourly compute utilization and backup tracking for the current billing cycle.
          </p>
        </div>
        <Link
          href="/billing"
          className="py-2 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border)] transition-colors self-start sm:self-auto shadow-2xs"
        >
          <span>View Invoices</span>
        </Link>
      </div>

      {/* Hero Overview */}
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[var(--primary)]" />
            Current Cycle Period
          </span>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {estimate.period.start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
            {estimate.period.end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[var(--border)] pt-4 font-mono">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Total Compute Used</span>
            <span className="text-lg font-serif font-bold text-[var(--text-primary)] block mt-0.5">
              {formatPaiseToRupees(estimate.totalComputePaise)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Total Backup Charges</span>
            <span className="text-lg font-serif font-bold text-[var(--text-primary)] block mt-0.5">
              {formatPaiseToRupees(estimate.totalBackupPaise)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Estimated Month Total</span>
            <span className="text-lg font-serif font-bold text-[var(--primary)] block mt-0.5">
              {formatPaiseToRupees(estimate.totalEstimatedPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Instance Usage Table */}
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--primary)]" />
          Instance Usage Breakdown ({estimate.instanceCalculations.length})
        </h2>

        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--muted)] uppercase font-mono">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Instance</th>
                  <th className="py-2.5 px-4 font-medium">Plan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Hourly Rate</th>
                  <th className="py-2.5 px-4 font-medium text-right">Billable Hours</th>
                  <th className="py-2.5 px-4 font-medium text-right">Backups</th>
                  <th className="py-2.5 px-4 font-medium text-right">Discount</th>
                  <th className="py-2.5 px-4 font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono">
                {estimate.instanceCalculations.map((inst) => (
                  <tr key={inst.instanceId} className="hover:bg-[var(--surface-2)]/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-[var(--text-primary)] font-sans">
                      <Link
                        href={`/database/${inst.instanceId}`}
                        className="hover:underline text-[var(--primary)]"
                      >
                        {inst.instanceName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">
                      {inst.planName}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                      ₹{inst.hourlyRatePaise / 100}/hr
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-primary)] font-bold">
                      {inst.billableHours.toFixed(1)} hrs
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                      {inst.backupAmountPaise > 0 ? `+${formatPaiseToRupees(inst.backupAmountPaise)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                      {inst.discountPaise > 0 ? `-${formatPaiseToRupees(inst.discountPaise)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-serif font-bold text-[var(--text-primary)]">
                      {formatPaiseToRupees(inst.totalPaise)}
                    </td>
                  </tr>
                ))}
                {estimate.instanceCalculations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs font-sans text-[var(--muted)]">
                      No billable usage recorded in this cycle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <Info className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
          <span>
            Usage is calculated by continuous second-level tracking while instances remain in active state. Terminated instances stop accumulating immediately.
          </span>
        </div>
      </div>
    </div>
  );
}
