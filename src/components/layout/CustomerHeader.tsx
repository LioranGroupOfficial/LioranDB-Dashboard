'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Bell, Menu } from 'lucide-react';

import ThemeToggle from '@/components/theme/ThemeToggle';

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
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--header-bg)] flex items-center justify-between px-3 sm:px-6 z-10 transition-colors duration-150">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-[5px] bg-[var(--surface)] border border-[var(--border)] shadow-xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
          <span className="text-[11px] font-mono text-[var(--text-secondary)] hidden md:inline">
            SYSTEM <span className="text-[var(--text-strong)] font-bold">ONLINE</span>
          </span>
          <span className="text-[11px] font-mono text-[var(--text-strong)] md:hidden font-bold">
            ONLINE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <ThemeToggle />

        <Link
          href="/account"
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-[4px] text-[9px] flex items-center justify-center font-bold bg-[var(--primary)] text-[var(--on-primary)] shadow-sm font-mono">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/account"
          className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-xs text-[var(--text-primary)] transition-colors group shrink-0"
        >
          <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-[4px] bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
            {email.slice(0, 1).toUpperCase()}
          </div>
          <span className="font-mono text-xs max-w-[120px] sm:max-w-[160px] md:max-w-[200px] truncate text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] hidden sm:inline">
            {email}
          </span>
        </Link>
      </div>
    </header>
  );
}
