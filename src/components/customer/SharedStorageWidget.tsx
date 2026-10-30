'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatBytes } from '@/lib/liorandb-admin/shared-hosting';
import { StorageWidgetSkeleton } from '@/components/dashboard/skeletons';
import RefreshIndicator from '@/components/dashboard/widgets/RefreshIndicator';

interface Usage { storage_used_bytes: number; storage_quota_bytes: number; remaining_bytes: number; percentage: number; measured_at_unix_ms: number; freshness: string; }

export default function SharedStorageWidget({ tenantId }: { tenantId: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function load(background = false) { if (!background) setRefreshing(true); try { const response = await fetch(`/api/customer/free-tier/${encodeURIComponent(tenantId)}/usage`, { cache: 'no-store' }); if (!response.ok) throw new Error(); const data = await response.json(); if (data.usage) { setUsage(data.usage); setError(false); } } catch { setError(true); } finally { setRefreshing(false); } }
  useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 45000); return () => clearInterval(timer); }, [tenantId]);
  if (!usage && !error) return <StorageWidgetSkeleton />;
  if (!usage) return <div className="card min-h-[164px] p-5"><p className="font-semibold text-[var(--text-strong)]">Storage usage unavailable</p><p className="mt-1 text-xs text-[var(--text-muted)]">The Rust control plane did not return current usage.</p><button type="button" onClick={() => void load()} className="btn-secondary mt-3 min-h-[34px] px-3 py-1.5 text-xs">Retry</button></div>;
  const percent = Math.min(100, Math.max(0, usage.percentage));
  return <div className="card min-h-[164px] space-y-4 p-5"><div className="flex items-start justify-between"><div><p className="label">Storage</p><p className="mt-2 font-mono text-xl font-bold text-[var(--text-strong)]">{formatBytes(usage.storage_used_bytes)} / {formatBytes(usage.storage_quota_bytes)}</p></div><div className="flex items-center gap-2"><RefreshIndicator refreshing={refreshing} measuredAt={new Date(usage.measured_at_unix_ms).toISOString()} /><button type="button" onClick={() => void load()} aria-label="Refresh storage usage" className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /></button></div></div><div className="h-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)]"><div className="h-full bg-[var(--primary)]" style={{ width: `${percent}%` }} /></div><div className="flex justify-between text-xs text-[var(--text-muted)]"><span>{Math.round(percent)}% utilized</span><span>{formatBytes(usage.remaining_bytes)} remaining</span></div>{percent >= 80 ? <p className="text-xs font-semibold text-[var(--text-strong)]">Storage is nearing its quota. Remove unused data or contact an administrator.</p> : null}</div>;
}
