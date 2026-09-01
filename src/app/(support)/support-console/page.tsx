import { requireAnyRole } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, HostingApplication } from '@/lib/db';
import Link from 'next/link';
import { LifeBuoy, Clock, FileText, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Developer Support Console — LioranDB' };

export default async function SupportConsolePage() {
  await requireAnyRole(['admin', 'support']);
  await connectToDatabase();

  const [tickets, pendingAppsCount] = await Promise.all([
    SupportTicket.find()
      .populate('userId', 'email profile')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    HostingApplication.countDocuments({ status: 'SUBMITTED' }),
  ]);

  const openTicketsCount = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Developer Support Console</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Technical queries resolution, developer assistance, and application review queue (Live Window: 6:00 PM – 10:00 PM IST)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/support-console/applications"
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Applications Queue ({pendingAppsCount})</span>
          </Link>
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
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Applications Awaiting Review</span>
            <FileText className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--accent)] mt-2">{pendingAppsCount}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">New applicant hosting submissions</span>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <LifeBuoy className="w-3.5 h-3.5 text-[var(--accent)]" />
          Customer Support Queue ({tickets.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
                const user = t.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
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
                    <td className="py-3 text-[var(--text-secondary)]">{t.category.replace(/_/g, ' ')}</td>
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
                        {t.status.replace(/_/g, ' ')}
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


