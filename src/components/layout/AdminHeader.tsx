import { ShieldAlert } from 'lucide-react';

export default function AdminHeader({ email }: { email: string }) {
  return (
    <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <p className="text-xs font-semibold text-[var(--text-primary)]">Admin Control Center</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)]">
          <div className="w-5 h-5 rounded-sm bg-amber-400 text-black flex items-center justify-center font-bold text-[10px]">
            A
          </div>
          <span className="font-mono text-xs max-w-[180px] truncate">{email}</span>
        </div>
      </div>
    </header>
  );
}

