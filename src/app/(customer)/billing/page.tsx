import { requireRegisteredUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Subscription, Payment, ManagedDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDateIST } from '@/lib/billing';
import { CreditCard, CheckCircle2, ShieldCheck, Database, Calendar, Lock } from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';
import Link from 'next/link';

export const metadata = { title: 'Billing & Subscriptions — LioranDB' };

export default async function BillingPage() {
  const sessionUser = await requireRegisteredUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const [subscriptions, payments, instances] = await Promise.all([
    Subscription.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    ManagedDatabase.find({ customerId: user._id, status: { $ne: 'DELETED' } }).lean(),
  ]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)] tracking-tight">
          Billing &amp; Subscriptions
        </h1>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Manage your account registration, active monthly instance plans, and Razorpay transaction receipts.
        </p>
      </div>

      {/* Account Registration Status Banner */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
                  LioranDB Account Registration
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  Verified &amp; Active
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                One-time ₹100 registration fee completed on{' '}
                {user.accountRegistrationPaidAt
                  ? new Date(user.accountRegistrationPaidAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'account creation'}
                .
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="font-serif text-xl font-bold text-[var(--color-text-primary)]">
              ₹100
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)] block">
              One-time paid
            </span>
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
            Active Subscriptions ({subscriptions.filter((s) => s.status === 'ACTIVE').length})
          </h2>
          <Link
            href="/database/create"
            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            + Deploy New Instance
          </Link>
        </div>

        {subscriptions.length === 0 ? (
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 text-center text-xs text-[var(--color-text-secondary)]">
            No active database subscriptions. Deploy an instance to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {subscriptions.map((sub) => {
              const matchedInstance = instances.find(
                (inst) =>
                  inst._id.toString() === sub.databaseId?.toString() ||
                  inst._id.toString() === sub.instanceId?.toString()
              );

              return (
                <div
                  key={sub._id.toString()}
                  className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-serif text-base font-medium text-[var(--color-text-primary)]">
                        {sub.planName}
                      </span>
                      {matchedInstance && (
                        <span className="text-xs font-mono text-[var(--color-text-secondary)] px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
                          {matchedInstance.name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                      {sub.backupAddon && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Daily Backups Included (+₹500/mo)
                        </span>
                      )}
                      {sub.currentPeriodEnd && (
                        <span className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
                          <Calendar className="w-3.5 h-3.5" />
                          Next renewal: {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-[var(--color-border-subtle)]">
                    <span className="font-serif text-2xl font-bold text-[var(--color-text-primary)]">
                      ₹{sub.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)] block">
                      /month via Razorpay
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment History Table */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 shadow-xs space-y-4">
        <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)]">
          Payment &amp; Transaction Ledger ({payments.length})
        </h2>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[580px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] uppercase font-mono tracking-wider text-[10px]">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Razorpay Order / Ref</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {payments.map((p) => (
                <tr key={p._id.toString()} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                  <td className="py-3 text-[var(--color-text-tertiary)] font-mono">
                    {new Date(p.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 text-[var(--color-text-primary)] font-medium">
                    {p.notes || (p.type === 'registration' ? 'Account Registration Fee' : 'Instance Subscription')}
                  </td>
                  <td className="py-3">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                      {p.type || 'subscription'}
                    </span>
                  </td>
                  <td className="py-3 font-serif font-bold text-[var(--color-text-primary)]">
                    {p.amountPaise ? formatPaiseToRupees(p.amountPaise) : formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    {p.razorpayPaymentId || p.razorpayOrderId || p.transactionReference || '—'}
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        p.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : p.status === 'SUBMITTED'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : p.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
                    No payment ledger records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
