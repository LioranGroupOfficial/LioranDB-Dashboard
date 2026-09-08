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
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[#001e2b] flex items-center justify-between px-4 sm:px-6 z-10">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
          <span className="w-2 h-2 rounded-full bg-[var(--brand-green)] animate-pulse shadow-sm shadow-[var(--brand-green)]"></span>
          <span className="text-xs font-mono text-[var(--text-secondary)] hidden sm:inline">
            LioranDB Engine <span className="text-[var(--brand-green)] font-semibold">Online</span>
          </span>
          <span className="text-xs font-mono text-[var(--brand-green)] sm:hidden font-semibold">
            Online
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/account"
          className="relative p-2 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-2)] transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold bg-[var(--brand-green)] text-[var(--on-primary)] shadow-sm shadow-[var(--brand-green)]/40">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/account"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)] text-xs text-white transition-colors group"
        >
          <div className="w-5 h-5 rounded-full bg-[var(--brand-green)] text-[var(--on-primary)] flex items-center justify-center font-bold text-[10px]">
            {email.slice(0, 1).toUpperCase()}
          </div>
          <span className="font-mono text-xs max-w-[100px] sm:max-w-[160px] truncate text-[var(--text-secondary)] group-hover:text-white">{email}</span>
        </Link>
      </div>
    </header>
  );
}
