'use client';

import { ShieldAlert, Menu } from 'lucide-react';

interface Props {
  email: string;
  onMenuToggle?: () => void;
}

export default function AdminHeader({ email, onMenuToggle }: Props) {
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
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">Admin Control Center</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)]">
          <div className="w-5 h-5 rounded-sm bg-amber-400 text-black flex items-center justify-center font-bold text-[10px]">
            A
          </div>
          <span className="font-mono text-xs max-w-[110px] sm:max-w-[180px] truncate">{email}</span>
        </div>
      </div>
    </header>
  );
}
