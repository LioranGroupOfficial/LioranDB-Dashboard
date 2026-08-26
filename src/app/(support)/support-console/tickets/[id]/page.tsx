import { requireAnyRole } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, TicketMessage } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import TicketThread from '@/components/support/TicketThread';

export const metadata = { title: 'Ticket Handling — Support' };

export default async function SupportConsoleTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(['admin', 'support']);
  const { id } = await params;

  await connectToDatabase();
  const ticket = await SupportTicket.findById(id).populate('userId', 'email profile').lean();
  if (!ticket) notFound();

  const messages = await TicketMessage.find({ ticketId: ticket._id })
    .sort({ createdAt: 1 })
    .lean();

  const user = ticket.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;

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
    isInternal: m.isInternal,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/support-console" className="hover:text-[var(--text-primary)]">
          ← Back to Support Queue
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <span className="text-xs text-[var(--text-muted)]">Ticket #{ticketData.ticketNumber} · Customer: {user?.email}</span>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-1">{ticketData.subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-pending">{ticketData.status.replace(/_/g, ' ')}</span>
          <span className="badge badge-default">{ticketData.priority}</span>
        </div>
      </div>

      <TicketThread ticket={ticketData} messages={messageList} isStaff={true} />
    </div>
  );
}

