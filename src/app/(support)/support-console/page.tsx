import React from 'react';
import { requireAnyRole } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket } from '@/lib/db';
import Link from 'next/link';
import { LifeBuoy, MessageSquare, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Developer Support Console — LioranDB' };

interface SupportTicketDoc {
  _id: { toString(): string };
  ticketNumber: string;
  subject: string;
  category?: string;
  priority: string;
  status: string;
  userId?: { _id: string; email: string; profile?: { fullName?: string } } | null;
}

export default async function SupportConsolePage() {
  await requireAnyRole(['admin', 'support']);
  await connectToDatabase();

  const rawTickets = await SupportTicket.find()
    .populate('userId', 'email profile')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const tickets = rawTickets as unknown as SupportTicketDoc[];

  const openTicketsCount = tickets.filter(
    (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS'
  ).length;
  const closedTicketsCount = tickets.filter((t) => t.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Developer Support Console</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Technical queries resolution and developer assistance (Live Window: 6:00 PM – 10:00 PM IST)
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Open Support Tickets</span>
            <MessageSquare className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{openTicketsCount}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">Awaiting engineer reply or investigation</span>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Resolved Tickets</span>
            <LifeBuoy className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{closedTicketsCount}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">Successfully resolved inquiries</span>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <LifeBuoy className="w-3.5 h-3.5 text-[var(--accent)]" />
          Customer Support Queue ({tickets.length})
        </h2>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase">
                <th className="pb-3 font-semibold">Ticket ID &amp; Subject</th>
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Priority</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tickets.map((t) => {
                const user = t.userId;
                return (
                  <tr key={t._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="py-3">
                      <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">#{t.ticketNumber}</span>
                      <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">{t.subject}</div>
                    </td>
                    <td className="py-3">
                      <div className="text-[var(--text-primary)] font-medium">{user?.profile?.fullName || 'Customer'}</div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{user?.email}</div>
                    </td>
                    <td className="py-3 text-[var(--text-secondary)]">{t.category?.replace(/_/g, ' ')}</td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          t.priority === 'CRITICAL'
                            ? 'badge-suspended'
                            : t.priority === 'HIGH'
                            ? 'badge-pending'
                            : 'badge-default'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          t.status === 'OPEN' || t.status === 'IN_PROGRESS'
                            ? 'badge-pending'
                            : t.status === 'CLOSED'
                            ? 'badge-default'
                            : 'badge-active'
                        }`}
                      >
                        {t.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/support-console/tickets/${t._id.toString()}`}
                        className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                      >
                        <span>Handle</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                    No support tickets in queue.
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
