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
          <h1 className="text-2xl font-bold text-white tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage customer accounts, verified emails, and active database fleet instances.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Email Verification</th>
                <th className="px-5 py-3 font-medium">Active Instances</th>
                <th className="px-5 py-3 font-medium">Created Date</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => {
                const userInstances = instances.filter(
                  (i) =>
                    i.customerId?.toString() === u._id.toString() ||
                    i.userId?.toString() === u._id.toString()
                );

                return (
                  <tr key={u._id.toString()} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white text-xs">
                        {u.profile?.fullName || u.email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                          u.emailVerified
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {u.emailVerified ? 'Verified' : 'Pending OTP'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-white">
                      <span className="inline-flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{userInstances.length}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/customers/${u._id.toString()}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs"
                      >
                        <span>Manage</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-xs text-slate-500">
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
