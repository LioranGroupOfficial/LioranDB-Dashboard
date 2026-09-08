'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

interface Props {
  notifications: NotificationItem[];
}

export default function NotificationList({ notifications: initial }: Props) {
  const [notifications, setNotifications] = useState(initial);
  const [marking, setMarking] = useState(false);

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await fetch('/api/customer/notifications', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    } finally {
      setMarking(false);
    }
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">No notifications yet.</p>;
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllRead}
            disabled={marking}
            className="text-xs text-[var(--brand-green)] hover:underline transition-colors font-medium"
          >
            {marking ? 'Marking...' : 'Mark all as read'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-3.5 rounded-xl border text-sm transition-colors ${
              n.read
                ? 'border-[var(--border)] bg-[var(--surface-2)]/60 opacity-80'
                : 'border-[var(--accent)]/40 bg-[var(--surface)] shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className="font-semibold text-[var(--text-primary)] text-xs">{n.title}</span>
              <span className="text-xs text-[var(--text-muted)] shrink-0 font-mono">
                {new Date(n.createdAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{n.body}</p>
            {n.link && (
              <Link href={n.link} className="text-xs text-[var(--accent)] hover:underline mt-2 inline-block font-semibold">
                View details →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

