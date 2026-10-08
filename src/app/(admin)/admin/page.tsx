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
        <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Admin Control Center</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Infrastructure fleet monitoring, usage-based billing, discount coupons, and customer operations.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/customers" className="card p-5 hover:border-[var(--hairline-strong)] transition">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs uppercase tracking-wider font-mono font-medium">Total Customers</span>
            <Users className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-strong)] font-mono mt-2">{totalUsers}</p>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">Registered verified accounts</span>
        </Link>

        <Link href="/admin/databases" className="card p-5 hover:border-[var(--hairline-strong)] transition">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs uppercase tracking-wider font-mono font-medium">Active Instances</span>
            <Server className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-strong)] font-mono mt-2">{activeDbs}</p>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">Running deployments</span>
        </Link>

        <Link href="/admin/billing" className="card p-5 hover:border-[var(--hairline-strong)] transition">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs uppercase tracking-wider font-mono font-medium">Unpaid Invoices</span>
            <Receipt className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {openInvoices}
          </p>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">Awaiting payment settlement</span>
        </Link>

        <Link href="/admin/support" className="card p-5 hover:border-[var(--hairline-strong)] transition">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs uppercase tracking-wider font-mono font-medium">Open Tickets</span>
            <MessageSquare className="w-4 h-4 text-[var(--text-strong)]" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-strong)] font-mono mt-2">
            {openTickets}
          </p>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">Customer inquiries</span>
        </Link>
      </div>

      {/* Quick Action links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center space-x-2 text-[var(--text-strong)] font-semibold">
            <Server className="w-4 h-4 text-[var(--text-strong)]" />
            <h3 className="font-bold">Database Fleet</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Inspect instances, reset master passwords, suspend or terminate deployments.</p>
          <Link href="/admin/databases" className="inline-block text-xs font-semibold text-[var(--text-strong)] hover:underline">
            Manage Databases →
          </Link>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center space-x-2 text-[var(--text-strong)] font-semibold">
            <Receipt className="w-4 h-4 text-[var(--text-strong)]" />
            <h3 className="font-bold">Usage Billing</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Generate monthly invoices, mark invoices paid, and monitor usage records.</p>
          <Link href="/admin/billing" className="inline-block text-xs font-semibold text-[var(--text-strong)] hover:underline">
            Manage Billing →
          </Link>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center space-x-2 text-[var(--text-strong)] font-semibold">
            <Tag className="w-4 h-4 text-[var(--text-strong)]" />
            <h3 className="font-bold">Coupons &amp; Promos ({couponsCount})</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Create percentage discounts for instances and plans with redemption limits.</p>
          <Link href="/admin/coupons" className="inline-block text-xs font-semibold text-[var(--text-strong)] hover:underline">
            Manage Coupons →
          </Link>
        </div>
      </div>

      {/* Recent Audit Log */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Recent Audit Activity</span>
          </h2>
          <Link href="/admin/audit" className="text-xs font-semibold text-[var(--text-strong)] hover:underline">
            View full log →
          </Link>
        </div>

        <div className="divide-y divide-[var(--border)] text-xs font-mono">
          {(recentAudit as unknown as AuditLogEntry[]).map((log) => (
            <div key={log._id.toString()} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-primary)] font-semibold">{log.action}</span>
                <span className="text-[var(--text-muted)] truncate font-sans">
                  {log.entityType ? `${log.entityType} ${log.entityId || ''}` : log.actorRole || 'system'}
                </span>
              </div>
              <span className="text-[var(--text-muted)] shrink-0 text-[11px]">
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
            <p className="py-4 text-[var(--text-muted)] text-center font-sans">No recent audit activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
