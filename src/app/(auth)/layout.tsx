import { Database, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--background)] px-4 py-8 overflow-y-auto">
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-4">
        <Link href="/login" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[var(--accent)] flex items-center justify-center text-black font-bold">
            <Database className="w-4 h-4 text-black" />
          </div>
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Lioran<span className="text-[var(--accent)]">DB</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] font-mono">
            Console
          </span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Enterprise End-to-End Security</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--border)] text-xs text-[var(--text-muted)] gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-[var(--warning)]" />
            45k+ ops/sec Multi-Model Engine
          </span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} LioranDB Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

