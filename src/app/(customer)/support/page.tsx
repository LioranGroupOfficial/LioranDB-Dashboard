import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, User } from '@/lib/db';
import Link from 'next/link';
import NewTicketForm from '@/components/support/NewTicketForm';

export const metadata = { title: 'Support' };

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
      ? 'Support is currently available (6:00 PM – 10:00 PM IST)'
      : 'Outside support hours. Tickets are received 24/7. Responses during evening hours (6:00 PM – 10:00 PM IST).',
  };
}

export default async function SupportPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const tickets = await SupportTicket.find({ userId: sessionUser.userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const { isOpen, message } = getSupportStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Support</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Get help with your managed hosting
          </p>
        </div>
      </div>

      {/* Support hours banner */}
      <div className={`alert-banner ${isOpen ? 'alert-banner-success' : 'alert-banner-info'} text-sm`}>
        <div>
          <strong>Support Hours: Daily, 6:00 PM – 10:00 PM IST (evening)</strong>
          <p className="mt-1">{message}</p>
          <p className="mt-1">Ticket submission is available 24/7.</p>
        </div>
      </div>

      {/* New ticket */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Create New Ticket
        </h2>
        <NewTicketForm />
      </div>

      {/* Existing tickets */}
      {tickets.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
            Your Tickets
          </h2>
          <div className="space-y-0 divide-y" style={{ borderColor: 'var(--border)' }}>
            {tickets.map((ticket) => (
              <Link
                key={ticket._id.toString()}
                href={`/support/${ticket._id.toString()}`}
                className="flex items-center justify-between py-3 gap-4 hover:opacity-80 transition-opacity"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)] truncate">{ticket.subject}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    #{ticket.ticketNumber} · {ticket.category.replace(/_/g, ' ')} ·{' '}
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
                        : 'badge-pending'
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
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tickets.length === 0 && (
        <div className="card">
          <p className="text-sm text-[var(--text-secondary)]">No tickets yet. Create one above if you need help.</p>
        </div>
      )}
    </div>
  );
}
