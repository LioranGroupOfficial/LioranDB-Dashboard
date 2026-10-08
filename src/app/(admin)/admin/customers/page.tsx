import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, IUser, IManagedDatabase } from '@/lib/db';
import Link from 'next/link';
import { Database, ArrowUpRight } from 'lucide-react';

export const metadata = { title: 'Customers — Admin Control Plane' };

export default async function AdminCustomersPage() {
  await requireAdmin();
  await connectToDatabase();

  const [users, instances] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean<IUser[]>(),
    ManagedDatabase.find({ status: { $nin: ['DELETED', 'TERMINATED'] } }).lean<IManagedDatabase[]>(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Customers</h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Manage customer accounts, verified emails, and active database fleet instances.
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Email Verification</th>
                <th className="px-4 py-3 font-medium">Active Instances</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {users.map((u) => {
                const userInstances = instances.filter(
                  (i) =>
                    i.customerId?.toString() === u._id.toString() ||
                    i.userId?.toString() === u._id.toString()
                );

                return (
                  <tr key={u._id.toString()} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[var(--text-strong)] text-sm font-sans">
                        {u.profile?.fullName || u.email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`badge ${
                          u.emailVerified
                            ? 'badge-active'
                            : 'badge-default'
                        }`}
                      >
                        {u.emailVerified ? 'Verified' : 'Pending OTP'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-strong)] font-bold">
                      <span className="inline-flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>{userInstances.length}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/customers/${u._id.toString()}`}
                        className="btn-secondary py-1 px-2.5 min-h-[30px] text-xs inline-flex items-center gap-1"
                      >
                        <span>Manage</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-xs text-[var(--text-muted)] font-sans">
                    No customers found.
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
