import { requireRegisteredUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Subscription, ManagedDatabase, Wallet, WalletTransaction } from '@/lib/db';
import { redirect } from 'next/navigation';
import { CreditCard, CheckCircle2, ShieldCheck, Database, Calendar, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatPaiseToRupees, getPlan } from '@/lib/plans';
import AddCreditsModal from '@/components/wallet/AddCreditsModal';
import { getOrCreateWallet } from '@/lib/wallet';
import Link from 'next/link';

export const metadata = { title: 'Billing & Credits — LioranDB' };

export default async function BillingPage() {
  const sessionUser = await requireRegisteredUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const [subscriptions, transactions, instances, wallet] = await Promise.all([
    Subscription.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    WalletTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).lean(),
    ManagedDatabase.find({ customerId: user._id, status: { $ne: 'DELETED' } }).lean(),
    getOrCreateWallet(user._id),
  ]);

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'GRACE_PERIOD');

  const totalMonthlySpendPaise = activeSubscriptions.reduce((acc, sub) => {
    return acc + (sub.totalPricePaise || sub.monthlyPricePaise || Math.round(sub.amount * 100));
  }, 0);

  const isLowBalance = wallet.balancePaise < totalMonthlySpendPaise && activeSubscriptions.length > 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)] tracking-tight">
            LioranDB Credits &amp; Billing
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Prepaid credit balance, automatic instance renewals, and immutable transaction ledger.
          </p>
        </div>
        <AddCreditsModal buttonText="Add Credits" />
      </div>

      {/* Credit Balance Hero Card */}
      <div className="bg-gradient-to-r from-[var(--color-surface-raised)] to-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
              <WalletIcon className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Available Prepaid Balance</span>
            </div>
            <div className="font-serif text-4xl sm:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {formatPaiseToRupees(wallet.balancePaise)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AddCreditsModal
              buttonText="+ Top Up Balance"
              className="py-3 px-6 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[var(--color-border-subtle)] pt-6 text-xs font-mono">
          <div>
            <span className="text-[var(--color-text-tertiary)] uppercase block">Estimated Monthly Usage</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)] mt-1 block">
              {formatPaiseToRupees(totalMonthlySpendPaise)} / mo
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-tertiary)] uppercase block">Lifetime Credits Deposited</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {formatPaiseToRupees(wallet.lifetimeCreditsAddedPaise)}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-tertiary)] uppercase block">Lifetime Credits Consumed</span>
            <span className="text-sm font-bold text-[var(--color-text-secondary)] mt-1 block">
              {formatPaiseToRupees(wallet.lifetimeCreditsUsedPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Action Recommended: Top Up Balance
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Your available balance ({formatPaiseToRupees(wallet.balancePaise)}) is less than your monthly commitments ({formatPaiseToRupees(totalMonthlySpendPaise)}). Top up to guarantee automatic service continuity.
              </p>
            </div>
          </div>
          <AddCreditsModal buttonText="Add Credits" />
        </div>
      )}

      {/* Next Expected Renewal Charges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
            Upcoming Renewal Charges ({activeSubscriptions.length})
          </h2>
          <Link
            href="/database/create"
            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            + Deploy Instance
          </Link>
        </div>

        {activeSubscriptions.length === 0 ? (
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 text-center text-xs text-[var(--color-text-secondary)]">
            No active subscriptions. Deployed instances will appear here with auto-renewal dates.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activeSubscriptions.map((sub) => {
              const matchedInstance = instances.find(
                (inst) =>
                  inst._id.toString() === sub.databaseId?.toString() ||
                  inst._id.toString() === sub.instanceId?.toString()
              );
              const pricePaise =
                sub.totalPricePaise || sub.monthlyPricePaise || Math.round(sub.amount * 100);

              return (
                <div
                  key={sub._id.toString()}
                  className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
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
                        {sub.status === 'GRACE_PERIOD' ? 'Grace Period' : sub.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                      {sub.backupAddon && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Daily Backups
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Next charge:{' '}
                        {sub.nextBillingAt || sub.nextPaymentDate
                          ? new Date(sub.nextBillingAt || sub.nextPaymentDate!).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Monthly'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="font-serif text-xl font-bold text-[var(--color-text-primary)]">
                      {formatPaiseToRupees(pricePaise)}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] block">
                      Auto-debited from credits
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Immutable Transaction Ledger */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-normal text-[var(--color-text-primary)]">
              Credit Ledger &amp; Transactions ({transactions.length})
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Append-only audit trail of all deposits, instance deployments, and renewals.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase tracking-wider">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {transactions.map((tx) => {
                const isCredit = tx.type === 'credit' || tx.type === 'refund';
                return (
                  <tr key={tx._id.toString()} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                    <td className="py-3 text-[var(--color-text-tertiary)] font-mono">
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 text-[var(--color-text-primary)] font-medium">
                      {tx.description}
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                        {tx.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {isCredit ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3" /> [CREDIT]
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" /> [DEBIT]
                          </>
                        )}
                      </span>
                    </td>
                    <td className={`py-3 text-right font-mono font-bold ${
                      isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text-primary)]'
                    }`}>
                      {isCredit ? `+${formatPaiseToRupees(tx.amountPaise)}` : `-${formatPaiseToRupees(tx.amountPaise)}`}
                    </td>
                    <td className="py-3 text-right font-mono text-[var(--color-text-secondary)] font-medium">
                      {formatPaiseToRupees(tx.balanceAfterPaise)}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                    No transactions recorded yet.
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
