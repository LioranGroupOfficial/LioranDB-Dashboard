'use client';

import { ShieldAlert, Menu } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface Props {
  email: string;
  onMenuToggle?: () => void;
}

export default function AdminHeader({ email, onMenuToggle }: Props) {
  return (
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--header-bg)] flex items-center justify-between px-3 sm:px-6 z-10 transition-colors duration-150">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-xs shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--accent-orange)] shrink-0" />
          <p className="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] hidden sm:inline">
            Admin Control Center
          </p>
          <p className="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] sm:hidden">
            Admin
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <ThemeToggle />

        <div className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-primary)] shrink-0">
          <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-[var(--accent-orange)] text-[var(--on-primary)] flex items-center justify-center font-bold text-[10px] shrink-0">
            A
          </div>
          <span className="font-mono text-xs max-w-[120px] sm:max-w-[180px] truncate text-[var(--text-secondary)] hidden sm:inline">
            {email}
          </span>
        </div>
      </div>
    </header>
  );
}
