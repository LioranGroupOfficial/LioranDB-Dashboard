import { requireAnyRole } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Support Console' };

export default async function SupportConsolePage() {
  await requireAnyRole(['admin', 'support']);
  await connectToDatabase();

  const tickets = await SupportTicket.find()
    .populate('userId', 'email profile')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Support Console</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Evening Support Hours: Daily 6:00 PM – 10:00 PM IST
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
              <th className="pb-3 font-medium">Ticket / Subject</th>
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium">Priority</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {tickets.map((t) => {
              const user = t.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
              return (
                <tr key={t._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                  <td className="py-3">
                    <span className="font-mono text-xs text-[var(--accent)] font-semibold">#{t.ticketNumber}</span>
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">{t.subject}</div>
                  </td>
                  <td className="py-3 text-xs">
                    <div className="text-[var(--text-primary)]">{user?.profile?.fullName || 'Customer'}</div>
                    <div className="text-[var(--text-secondary)]">{user?.email}</div>
                  </td>
                  <td className="py-3 text-xs text-[var(--text-muted)]">{t.category.replace(/_/g, ' ')}</td>
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
                      className="btn-secondary text-xs px-3 py-1 inline-block"
                    >
                      Handle →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                  No support tickets in queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

