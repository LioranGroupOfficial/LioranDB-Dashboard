import type { Metadata } from 'next';
import { Database, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/theme/ThemeToggle';

export const metadata: Metadata = {
  title: {
    default: 'Authentication',
    template: '%s — LioranDB Console',
  },
  description: 'Sign in or create an account for LioranDB Managed Cloud Database Platform.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--background)] px-4 py-8 overflow-y-auto selection:bg-[var(--brand-green)] selection:text-[var(--on-primary)] transition-colors duration-150">
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-4 border-b border-[var(--border)]">
        <Link href="/login" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-green)] flex items-center justify-center text-[var(--on-primary)] font-bold shadow-md shadow-[var(--brand-green)]/20 transition-transform group-hover:scale-105">
            <Database className="w-4 h-4 text-[var(--on-primary)]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Lioran<span className="text-[var(--accent)]">DB</span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)] font-mono font-medium">
            Console
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-medium">Enterprise TLS &amp; ACID</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--border)] text-xs text-[var(--text-muted)] gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Zap className="w-3.5 h-3.5 text-[var(--brand-green)]" />
            45k+ ops/sec Multi-Model Database Engine
          </span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} LioranDB Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
