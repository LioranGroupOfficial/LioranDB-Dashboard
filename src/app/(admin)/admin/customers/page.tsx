import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Customers — Admin' };

export default async function AdminCustomersPage() {
  await requireRole('admin');
  await connectToDatabase();

  const users = await User.find({ role: 'customer' })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-normal text-[var(--color-text-primary)]">Customers</h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Manage customer accounts, registration fee payments, and onboarding states
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-5 overflow-x-auto w-full shadow-xs">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase tracking-wider">
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Stage</th>
              <th className="pb-3 font-medium">Email Verified</th>
              <th className="pb-3 font-medium">Registration Fee</th>
              <th className="pb-3 font-medium">Joined</th>
              <th className="pb-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {users.map((u) => (
              <tr key={u._id.toString()} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                <td className="py-3">
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {u.profile?.fullName || 'Anonymous User'}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-tertiary)] font-mono">{u.email}</div>
                </td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                    {u.onboardingStage}
                  </span>
                </td>
                <td className="py-3 text-xs">
                  {u.emailVerified ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Verified</span>
                  ) : (
                    <span className="text-amber-500 font-medium">Pending</span>
                  )}
                </td>
                <td className="py-3 text-xs">
                  {u.accountRegistrationPaid ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ ₹100 Paid
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Unpaid
                    </span>
                  )}
                </td>
                <td className="py-3 text-[11px] text-[var(--color-text-tertiary)] font-mono">
                  {new Date(u.createdAt).toLocaleDateString('en-IN')}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/customers/${u._id.toString()}`}
                    className="py-1 px-2.5 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-block"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
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
