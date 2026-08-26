'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Props {
  email: string;
  userId: string;
}

export default function CustomerHeader({ email, userId }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/customer/notifications/unread-count')
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.count || 0))
      .catch(() => {});
  }, []);

  return (
    <header
      className="h-14 border-b flex items-center justify-between px-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div></div>
      <div className="flex items-center gap-4">
        <Link
          href="/account"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-medium bg-[var(--accent)] text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/account"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {email}
        </Link>
      </div>
    </header>
  );
}
