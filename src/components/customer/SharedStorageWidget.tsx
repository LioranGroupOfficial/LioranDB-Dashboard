'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatBytes } from '@/lib/liorandb-admin/shared-hosting';
import { StorageWidgetSkeleton } from '@/components/dashboard/skeletons';
import RefreshIndicator from '@/components/dashboard/widgets/RefreshIndicator';

const POLL_INTERVAL_MS = 10_000;

interface Usage {
  storage_used_bytes: number;
  storage_quota_bytes: number;
  remaining_bytes: number;
  percentage: number;
  measured_at_unix_ms: number;
  freshness: string;
}

function isValidUsage(value: unknown): value is Usage {
  if (!value || typeof value !== 'object') return false;
  const usage = value as Partial<Usage>;
  return typeof usage.storage_used_bytes === 'number' && Number.isFinite(usage.storage_used_bytes) && usage.storage_used_bytes >= 0
    && typeof usage.storage_quota_bytes === 'number' && Number.isFinite(usage.storage_quota_bytes) && usage.storage_quota_bytes > 0
    && typeof usage.remaining_bytes === 'number' && Number.isFinite(usage.remaining_bytes) && usage.remaining_bytes >= 0
    && typeof usage.percentage === 'number' && Number.isFinite(usage.percentage) && usage.percentage >= 0
    && typeof usage.measured_at_unix_ms === 'number' && Number.isFinite(usage.measured_at_unix_ms) && usage.measured_at_unix_ms > 0
    && typeof usage.freshness === 'string' && usage.freshness.length > 0;
}

function formatFreshness(freshness: string): string {
  return freshness.replaceAll('_', ' ').toLowerCase();
}

export default function SharedStorageWidget({ allocationId }: { allocationId: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    let controller: AbortController | null = null;

    const load = async (background = false) => {
      if (!mounted || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      controller = new AbortController();
      if (!background) setRefreshing(true);

      try {
        const response = await fetch(`/api/customer/free-tier/${encodeURIComponent(allocationId)}/usage`, {
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as { usage?: unknown } | null;
        if (!response.ok || !isValidUsage(data?.usage)) {
          throw new Error('Storage usage is unavailable.');
        }
        if (!mounted) return;
        setUsage(data.usage);
        setError(null);
      } catch (requestError) {
        if (!mounted || (requestError instanceof DOMException && requestError.name === 'AbortError')) return;
        setError('Storage usage refresh failed; showing the last successful measurement when available.');
      } finally {
        inFlight = false;
        controller = null;
        if (mounted) setRefreshing(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };

    refreshRef.current = () => void load();
    void load();
    const timer = window.setInterval(() => void load(true), POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      mounted = false;
      refreshRef.current = () => {};
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      controller?.abort();
    };
  }, [allocationId]);

  if (!usage && !error) return <StorageWidgetSkeleton />;
  if (!usage) {
    return (
      <div className="card min-h-[164px] p-5" role="status">
        <p className="font-semibold text-[var(--text-strong)]">Storage usage unavailable</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">The Rust control plane did not return a valid tenant measurement.</p>
        <button type="button" onClick={() => refreshRef.current()} className="btn-secondary mt-3 min-h-[34px] px-3 py-1.5 text-xs">
          Retry
        </button>
      </div>
    );
  }

  const barPercent = Math.min(100, Math.max(0, usage.percentage));
  const percentLabel = Number(usage.percentage.toFixed(2));
  const measuredAt = new Date(usage.measured_at_unix_ms).toISOString();
  const freshnessLabel = formatFreshness(usage.freshness);

  return (
    <div className="card min-h-[164px] space-y-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Storage</p>
          <p className="mt-2 font-mono text-xl font-bold text-[var(--text-strong)]">
            {formatBytes(usage.storage_used_bytes)} / {formatBytes(usage.storage_quota_bytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshIndicator refreshing={refreshing} measuredAt={measuredAt} />
          <button
            type="button"
            onClick={() => refreshRef.current()}
            disabled={refreshing}
            aria-label="Refresh storage usage"
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)]">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${barPercent}%` }} />
      </div>

      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{percentLabel}% utilized</span>
        <span>{formatBytes(usage.remaining_bytes)} remaining</span>
      </div>

      <div className="space-y-1 text-[11px] text-[var(--text-muted)]">
        <p>Rust measurement: {freshnessLabel}</p>
        {error ? <p role="status">{error}</p> : null}
      </div>

      {barPercent >= 80 ? <p className="text-xs font-semibold text-[var(--text-strong)]">Storage is nearing its quota. Remove unused data or contact an administrator.</p> : null}
    </div>
  );
}
