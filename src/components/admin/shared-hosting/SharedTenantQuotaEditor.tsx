'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FREE_SHARED_STORAGE_BYTES, formatBytes } from '@/lib/liorandb-admin/shared-hosting';
import { useRouter } from 'next/navigation';

export default function SharedTenantQuotaEditor({ tenantId, currentQuota }: { tenantId: string; currentQuota: number }) {
  const router = useRouter();
  const [quotaMiB, setQuotaMiB] = useState(String(Math.round(currentQuota / (1024 * 1024))));
  const [busy, setBusy] = useState(false);
  async function save() {
    const bytes = Number(quotaMiB) * 1024 * 1024;
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > FREE_SHARED_STORAGE_BYTES) { window.alert(`Quota must be between 1 MiB and ${formatBytes(FREE_SHARED_STORAGE_BYTES)}.`); return; }
    setBusy(true);
    try { const response = await fetch(`/api/admin/shared-hosting/${encodeURIComponent(tenantId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storage_quota_bytes: bytes }) }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Quota update failed.'); } router.refresh(); } catch (error) { window.alert(error instanceof Error ? error.message : 'Quota update failed.'); } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-end gap-2"><label className="text-xs"><span className="label mb-1 block">Quota (MiB)</span><input type="number" min={1} max={512} value={quotaMiB} onChange={(event) => setQuotaMiB(event.target.value)} className="input-field h-9 w-28 text-xs" /></label><button type="button" onClick={() => void save()} disabled={busy} className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Save quota</button></div>;
}
