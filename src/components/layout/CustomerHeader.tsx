'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface Props {
  email: string;
  userId?: string;
  onMenuToggle?: () => void;
}

export default function CustomerHeader({ email, onMenuToggle }: Props) {
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

      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <ThemeToggle />

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
