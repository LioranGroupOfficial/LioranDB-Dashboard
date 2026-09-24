import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, Wallet, ManagedDatabase } from '@/lib/db';
import Link from 'next/link';
import { formatPaiseToRupees } from '@/lib/plans';
import AdminWalletAdjustModal from '@/components/wallet/AdminWalletAdjustModal';

export const metadata = { title: 'Customers — Admin' };

export default async function AdminCustomersPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [users, wallets, instances] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean(),
    Wallet.find().lean(),
    ManagedDatabase.find({ status: { $nin: ['DELETED', 'TERMINATED'] } }).lean(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-normal text-[var(--color-text-primary)]">Customers</h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Manage customer accounts, prepaid credit balances, and active instances
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 overflow-x-auto w-full shadow-xs">
        <table className="w-full text-left text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase tracking-wider">
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Credit Balance</th>
              <th className="pb-3 font-medium">Lifetime Added</th>
              <th className="pb-3 font-medium">Lifetime Used</th>
              <th className="pb-3 font-medium">Active Instances</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {users.map((u) => {
              const wallet = wallets.find(
                (w) => w.userId.toString() === u._id.toString()
              );
              const userInstances = instances.filter(
                (i) => i.customerId.toString() === u._id.toString() || i.userId?.toString() === u._id.toString()
              );
              const balancePaise = wallet?.balancePaise || 0;

              return (
                <tr key={u._id.toString()} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">
                      {u.profile?.fullName || 'Anonymous User'}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)] font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 font-serif font-bold text-[var(--color-text-primary)]">
                    {formatPaiseToRupees(balancePaise)}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    {formatPaiseToRupees(wallet?.lifetimeCreditsAddedPaise || 0)}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    {formatPaiseToRupees(wallet?.lifetimeCreditsUsedPaise || 0)}
                  </td>
                  <td className="py-3 font-mono text-xs text-[var(--color-text-primary)]">
                    {userInstances.length} cluster{userInstances.length === 1 ? '' : 's'}
                  </td>
                  <td className="py-3 text-xs">
                    {u.accountRegistrationPaid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Unactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AdminWalletAdjustModal
                        targetUserId={u._id.toString()}
                        targetUserEmail={u.email}
                        currentBalanceRupees={balancePaise / 100}
                      />
                      <Link
                        href={`/admin/customers/${u._id.toString()}`}
                        className="py-1 px-2.5 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-block"
                      >
                        Manage →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
