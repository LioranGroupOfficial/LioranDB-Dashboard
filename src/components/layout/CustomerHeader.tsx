'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Bell, Menu } from 'lucide-react';

interface Props {
  email: string;
  userId: string;
  onMenuToggle?: () => void;
}

export default function CustomerHeader({ email, userId, onMenuToggle }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/customer/notifications/unread-count')
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.count || 0))
      .catch(() => {});
  }, []);

  return (
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-3 sm:px-6 z-10">
      <div className="flex items-center gap-2.5">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">
            LioranDB Engine Online
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)] sm:hidden">
            Online
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/account"
          className="relative p-1.5 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold bg-[var(--accent)] text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/account"
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-light)] text-xs text-[var(--text-primary)] transition-colors"
        >
          <div className="w-5 h-5 rounded-sm bg-[var(--accent)] text-black flex items-center justify-center font-bold text-[10px]">
            {email.slice(0, 1).toUpperCase()}
          </div>
          <span className="font-mono text-xs max-w-[100px] sm:max-w-[160px] truncate">{email}</span>
        </Link>
      </div>
    </header>
  );
}
