'use client';

export default function RefreshIndicator({ refreshing, measuredAt }: { refreshing: boolean; measuredAt?: string }) {
  return <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]" aria-live="polite">{refreshing ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" /> : null}{refreshing ? 'Refreshing' : measuredAt ? `Updated ${new Date(measuredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>;
}
