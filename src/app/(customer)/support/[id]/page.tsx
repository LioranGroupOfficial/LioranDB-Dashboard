import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, TicketMessage } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import TicketThread from '@/components/support/TicketThread';
import Link from 'next/link';

export const metadata = { title: 'Ticket Details' };

export default async function CustomerTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireVerifiedUser();
  const { id } = await params;

  await connectToDatabase();

  const ticket = await SupportTicket.findById(id).lean();
  if (!ticket) notFound();

  // Enforce customer ownership
  if (ticket.userId.toString() !== sessionUser.userId && sessionUser.role === 'customer') {
    redirect('/support');
  }

  // Fetch messages — EXCLUDING internal notes for customer view
  const messages = await TicketMessage.find({
    ticketId: ticket._id,
    isInternal: false,
  })
    .sort({ createdAt: 1 })
    .lean();

  const ticketData = {
    id: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    url: ticket.url,
    environment: ticket.environment,
    createdAt: ticket.createdAt.toISOString(),
  };

  const messageList = messages.map((m) => ({
    id: m._id.toString(),
    authorRole: m.authorRole,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/support" className="hover:text-[var(--text-primary)]">
          ← Back to Support
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <span className="text-xs text-[var(--text-muted)]">Ticket #{ticketData.ticketNumber}</span>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-1">{ticketData.subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-pending">{ticketData.status.replace(/_/g, ' ')}</span>
          <span className="badge badge-default">{ticketData.priority}</span>
        </div>
      </div>

      <TicketThread ticket={ticketData} messages={messageList} />
    </div>
  );
}

