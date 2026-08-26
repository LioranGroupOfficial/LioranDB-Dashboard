'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
  isInternal?: boolean;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  url?: string;
  environment?: string;
  createdAt: string;
}

interface Props {
  ticket: Ticket;
  messages: Message[];
  isStaff?: boolean;
}

export default function TicketThread({ ticket, messages: initialMessages, isStaff = false }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [reply, setReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;

    setLoading(true);
    setError('');

    const endpoint = isStaff
      ? `/api/admin/support/${ticket.id}/messages`
      : `/api/customer/tickets/${ticket.id}/messages`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: reply,
          isInternal: isStaff ? isInternalNote : false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send message.');
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.message._id || String(Date.now()),
          authorRole: data.message.authorRole || (isStaff ? 'admin' : 'customer'),
          body: reply,
          createdAt: new Date().toISOString(),
          isInternal: isInternalNote,
        },
      ]);
      setReply('');
      setIsInternalNote(false);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseTicket() {
    if (!confirm('Are you sure you want to close this ticket?')) return;
    setClosing(true);
    try {
      const endpoint = isStaff
        ? `/api/admin/support/${ticket.id}/status`
        : `/api/customer/tickets/${ticket.id}/close`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setClosing(false);
    }
  }

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* Ticket Details Box */}
      <div className="card space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[var(--text-muted)]">Category</span>
            <p className="font-medium text-[var(--text-primary)] mt-0.5">{ticket.category.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Priority</span>
            <p className="font-medium text-[var(--text-primary)] mt-0.5">{ticket.priority}</p>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Created</span>
            <p className="font-medium text-[var(--text-primary)] mt-0.5">
              {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
          {ticket.url && (
            <div>
              <span className="text-[var(--text-muted)]">Related URL</span>
              <p className="font-medium text-[var(--accent)] mt-0.5 truncate">
                <a href={ticket.url} target="_blank" rel="noopener noreferrer">
                  {ticket.url}
                </a>
              </p>
            </div>
          )}
        </div>
        {ticket.environment && (
          <div className="text-xs pt-2 border-t border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Environment: </span>
            <span className="text-[var(--text-secondary)]">{ticket.environment}</span>
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <div className="space-y-4">
        {messages.map((m) => {
          const isStaffAuthor = m.authorRole === 'admin' || m.authorRole === 'support';
          const isInternal = m.isInternal;

          return (
            <div
              key={m.id}
              className={`p-4 rounded-lg border text-sm ${
                isInternal
                  ? 'border-yellow-600/40 bg-yellow-950/20'
                  : isStaffAuthor
                  ? 'border-[var(--accent)]/40 bg-[var(--surface)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border)]/50">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">
                    {isStaffAuthor ? 'LioranDB Support' : 'You (Customer)'}
                  </span>
                  {isStaffAuthor && (
                    <span className="badge badge-pending text-[10px]">Staff</span>
                  )}
                  {isInternal && (
                    <span className="badge badge-suspended text-[10px]">Internal Note</span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(m.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {m.body}
              </p>
            </div>
          );
        })}
      </div>

      {/* Reply or Closed notice */}
      {isClosed ? (
        <div className="card text-center py-6">
          <p className="text-sm text-[var(--text-muted)]">
            This ticket has been marked as closed.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSendReply} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Reply to ticket</h3>
            {!isClosed && (
              <button
                type="button"
                onClick={handleCloseTicket}
                disabled={closing}
                className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                {closing ? 'Closing...' : 'Close ticket'}
              </button>
            )}
          </div>

          {error && (
            <div className="alert-banner alert-banner-error text-xs" role="alert">
              {error}
            </div>
          )}

          <textarea
            required
            rows={4}
            className="input-field text-sm"
            placeholder={
              isInternalNote
                ? 'Type an internal note (only visible to team members)...'
                : 'Type your reply...'
            }
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />

          <div className="flex items-center justify-between">
            {isStaff ? (
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Post as internal note
              </label>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">
                Evening support hours: 6:00 PM – 10:00 PM IST
              </span>
            )}

            <button
              type="submit"
              disabled={loading || !reply.trim()}
              className="btn-primary"
            >
              {loading ? 'Sending...' : isInternalNote ? 'Add internal note' : 'Send reply'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

