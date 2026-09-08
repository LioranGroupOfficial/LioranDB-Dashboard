'use client';

import { ShieldAlert, Menu } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface Props {
  email: string;
  onMenuToggle?: () => void;
}

export default function AdminHeader({ email, onMenuToggle }: Props) {
  return (
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--header-bg)] flex items-center justify-between px-4 sm:px-6 z-10 transition-colors duration-150">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--accent-orange)]" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">Admin Control Center</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        <ThemeToggle />

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-primary)]">
          <div className="w-5 h-5 rounded-full bg-[var(--accent-orange)] text-[var(--on-primary)] flex items-center justify-center font-bold text-[10px]">
            A
          </div>
          <span className="font-mono text-xs max-w-[110px] sm:max-w-[180px] truncate text-[var(--text-secondary)]">{email}</span>
        </div>
      </div>
    </header>
  );
}
