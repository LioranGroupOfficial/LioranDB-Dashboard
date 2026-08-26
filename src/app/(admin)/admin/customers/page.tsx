import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Subscription } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Customers — Admin' };

export default async function AdminCustomersPage() {
  await requireRole('admin');
  await connectToDatabase();

  const users = await User.find({ role: 'customer' })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Customers</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage customer accounts, roles, and onboarding states
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Stage</th>
              <th className="pb-3 font-medium">Email Verified</th>
              <th className="pb-3 font-medium">Joined</th>
              <th className="pb-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <tr key={u._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                <td className="py-3">
                  <div className="font-medium text-[var(--text-primary)]">
                    {u.profile?.fullName || 'Anonymous'}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{u.email}</div>
                </td>
                <td className="py-3">
                  <span className="badge badge-default font-mono text-xs">
                    {u.onboardingStage}
                  </span>
                </td>
                <td className="py-3 text-xs">
                  {u.emailVerified ? (
                    <span className="text-green-400">✓ Verified</span>
                  ) : (
                    <span className="text-yellow-400">Pending</span>
                  )}
                </td>
                <td className="py-3 text-xs text-[var(--text-muted)]">
                  {new Date(u.createdAt).toLocaleDateString('en-IN')}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/customers/${u._id.toString()}`}
                    className="btn-secondary text-xs px-3 py-1 inline-block"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-[var(--text-secondary)]">
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

