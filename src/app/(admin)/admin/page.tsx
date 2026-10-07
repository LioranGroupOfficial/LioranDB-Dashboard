import React from 'react';
import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Invoice, SupportTicket, AuditLog, Coupon } from '@/lib/db';
import Link from 'next/link';
import { Users, Server, Receipt, MessageSquare, Tag, ShieldCheck } from 'lucide-react';

export const metadata = { title: 'Admin Overview' };

interface AuditLogEntry {
  _id: { toString(): string };
  action: string;
  entityType?: string;
  entityId?: string;
  actorRole?: string;
  createdAt: Date | string;
}

export default async function AdminDashboardPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [
    totalUsers,
    activeDbs,
    openInvoices,
    openTickets,
    couponsCount,
    recentAudit,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    ManagedDatabase.countDocuments({ status: { $in: ['ACTIVE', 'RUNNING'] } }),
    Invoice.countDocuments({ status: { $in: ['OPEN', 'OVERDUE'] } }),
    SupportTicket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] } }),
    Coupon.countDocuments({ enabled: true }),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Control Center</h1>
        <p className="mt-1 text-sm text-slate-400">
          Infrastructure fleet monitoring, usage-based billing, discount coupons, and customer operations.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/customers" className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Total Customers</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">{totalUsers}</p>
          <span className="text-xs text-slate-500 mt-1 block">Registered verified accounts</span>
        </Link>

        <Link href="/admin/instances" className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Active Instances</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{activeDbs}</p>
          <span className="text-xs text-slate-500 mt-1 block">Running deployments</span>
        </Link>

        <Link href="/admin/billing" className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Unpaid Invoices</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <p className={`text-3xl font-bold mt-2 ${openInvoices > 0 ? 'text-amber-400' : 'text-white'}`}>
            {openInvoices}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting payment settlement</span>
        </Link>

        <Link href="/admin/support" className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Open Tickets</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <p className={`text-3xl font-bold mt-2 ${openTickets > 0 ? 'text-amber-400' : 'text-white'}`}>
            {openTickets}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Customer inquiries</span>
        </Link>
      </div>

      {/* Quick Action links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3>Database Fleet</h3>
          </div>
          <p className="text-xs text-slate-400">Inspect instances, reset master passwords, suspend or terminate deployments.</p>
          <Link href="/admin/instances" className="inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300">
            Manage Fleet →
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <h3>Usage Billing</h3>
          </div>
          <p className="text-xs text-slate-400">Generate monthly invoices, mark invoices paid, and monitor usage records.</p>
          <Link href="/admin/billing" className="inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300">
            Manage Billing →
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Tag className="w-4 h-4 text-amber-400" />
            <h3>Coupons &amp; Promos ({couponsCount})</h3>
          </div>
          <p className="text-xs text-slate-400">Create percentage discounts for instances and plans with redemption limits.</p>
          <Link href="/admin/coupons" className="inline-block text-xs font-medium text-amber-400 hover:text-amber-300">
            Manage Coupons →
          </Link>
        </div>
      </div>

      {/* Recent Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Recent Audit Activity</span>
          </h2>
          <Link href="/admin/audit" className="text-xs text-indigo-400 hover:underline">
            View full log →
          </Link>
        </div>

        <div className="divide-y divide-slate-800 text-xs">
          {(recentAudit as unknown as AuditLogEntry[]).map((log) => (
            <div key={log._id.toString()} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">{log.action}</span>
                <span className="text-slate-400 truncate">
                  {log.entityType ? `${log.entityType} ${log.entityId || ''}` : log.actorRole || 'system'}
                </span>
              </div>
              <span className="text-slate-500 shrink-0">
                {new Date(log.createdAt).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
          {recentAudit.length === 0 && (
            <p className="py-4 text-slate-500 text-center">No recent audit activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
