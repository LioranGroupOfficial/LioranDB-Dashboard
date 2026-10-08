import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Invoice, SupportTicket, IManagedDatabase } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  Users,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

export const metadata = { title: 'Customer Details — Admin' };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  await connectToDatabase();
  const [customer, instances, invoices, tickets] = await Promise.all([
    User.findById(id).select('-passwordHash').lean(),
    ManagedDatabase.find({ $or: [{ customerId: id }, { userId: id }] })
      .sort({ createdAt: -1 })
      .lean<IManagedDatabase[]>(),
    Invoice.find({ customerId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  if (!customer) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/admin/customers" className="hover:text-white inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {customer.profile?.fullName || customer.email}
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">{customer.email}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium uppercase ${
            customer.emailVerified
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {customer.emailVerified ? 'Email Verified' : 'Unverified'}
        </span>
      </div>

      {/* Account Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Profile Information</span>
          </h2>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Company:</span>
            <span className="text-slate-200">{customer.profile?.company || '—'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Country:</span>
            <span className="text-slate-200">{customer.profile?.country || '—'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Phone:</span>
            <span className="text-slate-200">{customer.profile?.phone || '—'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Account Created:</span>
            <span className="text-slate-200">{new Date(customer.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>Account Summary</span>
          </h2>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Managed Databases:</span>
            <span className="font-semibold text-white">{instances.length}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Total Invoices:</span>
            <span className="text-slate-200">{invoices.length}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Support Tickets:</span>
            <span className="text-slate-200">{tickets.length}</span>
          </div>
        </div>
      </div>

      {/* Managed Databases Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Associated Database Instances</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Instance</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Billing State</th>
                <th className="px-5 py-3 font-medium">Created Date</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-xs">
                    No database instances deployed by this customer.
                  </td>
                </tr>
              ) : (
                instances.map((inst) => {
                  const isBillingActive =
                    (inst.status === 'ACTIVE' || inst.status === 'RUNNING') &&
                    inst.billingStartedAt &&
                    !inst.billingStoppedAt;

                  return (
                    <tr key={inst._id.toString()} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white text-xs">{inst.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{inst._id.toString()}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {inst.planName || (inst.planId === 'dedicated' ? 'Dedicated' : 'Shared')}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatPaiseToRupees(inst.hourlyRatePaise || 100)}/hr
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase ${
                            inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inst.status === 'SUSPENDED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : inst.status === 'RESETTING'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {isBillingActive ? (
                          <span className="text-emerald-400 font-medium">Active (Accruing)</span>
                        ) : inst.status === 'SUSPENDED' ? (
                          <span className="text-amber-400 font-medium">Paused</span>
                        ) : (
                          <span className="text-slate-500 font-medium">Stopped</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {new Date(inst.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/databases/${inst._id.toString()}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs"
                        >
                          <span>Manage Database</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
