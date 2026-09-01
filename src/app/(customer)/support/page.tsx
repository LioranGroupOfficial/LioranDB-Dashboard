import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, User } from '@/lib/db';
import Link from 'next/link';
import NewTicketForm from '@/components/support/NewTicketForm';
import { LifeBuoy, Clock, CheckCircle2, AlertCircle, Plus, MessageSquare, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Developer Support — LioranDB' };

// Support hours: Daily 6 PM – 10 PM IST
function getSupportStatus(): { isOpen: boolean; message: string } {
  const now = new Date();
  const istHour = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  ).getHours();
  const isOpen = istHour >= 18 && istHour < 22;
  return {
    isOpen,
    message: isOpen
      ? 'Developer Support engineers are live online (6:00 PM – 10:00 PM IST)'
      : 'Outside live evening hours. You can submit tickets 24/7; engineers resolve queries during daily evening window (6:00 PM – 10:00 PM IST).',
  };
}

export default async function SupportPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const tickets = await SupportTicket.find({ userId: sessionUser.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const { isOpen, message } = getSupportStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Developer Support</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Open technical assistance tickets for queries, connection troubleshooting, and infrastructure assistance
          </p>
        </div>
      </div>

      {/* Support hours banner */}
      <div className={`alert-banner ${isOpen ? 'alert-banner-success' : 'alert-banner-info'} text-xs`}>
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Support Window: Daily 6:00 PM – 10:00 PM IST</strong>
            <p className="mt-0.5">{message}</p>
          </div>
        </div>
      </div>

      {/* New ticket */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
          Create Support Query / Ticket
        </h2>
        <NewTicketForm />
      </div>

      {/* Existing tickets */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
          Your Support History ({tickets.length})
        </h2>

        {tickets.length > 0 ? (
          <div className="space-y-0 divide-y divide-[var(--border)]">
            {tickets.map((ticket) => (
              <Link
                key={ticket._id.toString()}
                href={`/support/${ticket._id.toString()}`}
                className="flex items-center justify-between py-3 gap-4 hover:bg-[var(--surface-2)]/50 transition-colors px-2 rounded-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{ticket.subject}</p>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                    #{ticket.ticketNumber} • {ticket.category.replace(/_/g, ' ')} •{' '}
                    {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`badge ${
                      ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'
                        ? 'badge-pending'
                        : ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                        ? 'badge-default'
                        : 'badge-active'
                    }`}
                  >
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`badge ${
                      ticket.priority === 'CRITICAL'
                        ? 'badge-suspended'
                        : ticket.priority === 'HIGH'
                        ? 'badge-pending'
                        : 'badge-default'
                    }`}
                  >
                    {ticket.priority}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] py-2">
            No support queries submitted yet.
          </p>
        )}
      </div>
    </div>
  );
}

