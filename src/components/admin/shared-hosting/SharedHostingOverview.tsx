'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, HardDrive, MemoryStick, RefreshCw, Server } from 'lucide-react';
import { formatBytes } from '@/lib/liorandb-admin/shared-hosting';
import RefreshIndicator from '@/components/dashboard/widgets/RefreshIndicator';

export interface SharedHostingOverviewData {
  status: { enabled: boolean; max_tenants: number; occupied_slots: number; available_slots: number; resources: { memory_limit_bytes: number; cpu_limit_cores: number } };
  storage: { logical_tenant_storage_bytes: number; logical_quota_bytes: number; physical_instance_accounted_bytes: number; freshness: string };
  serverStatus: { status: string; version: string; memoryBytesUsed?: number; uptimeSeconds: number };
  nodeName: string;
  measuredAt: string;
}

export default function SharedHostingOverview({ initial }: { initial: SharedHostingOverviewData }) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/shared-hosting', { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        if (payload.snapshot) setData(payload.snapshot);
      }
    } finally { setRefreshing(false); }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => { if (document.visibilityState === 'visible') void refresh(); };
    timer = setInterval(schedule, 30000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const cards = [
    ['Tenant slots', `${data.status.occupied_slots}/${data.status.max_tenants}`, `${data.status.available_slots} remaining`, Database],
    ['Pool memory', `${data.serverStatus.memoryBytesUsed === undefined ? 'Unavailable' : formatBytes(data.serverStatus.memoryBytesUsed)} / ${formatBytes(data.status.resources.memory_limit_bytes)}`, 'Current reported usage / limit', MemoryStick],
    ['Physical usage', formatBytes(data.storage.physical_instance_accounted_bytes), 'Instance accounted bytes', HardDrive],
    ['Logical quota', formatBytes(data.storage.logical_tenant_storage_bytes), `of ${formatBytes(data.storage.logical_quota_bytes)} allocated`, Activity],
  ] as const;

  return <section className="space-y-4"><div className="flex items-center justify-between"><div><p className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{data.nodeName}</p><h2 className="text-lg font-bold text-[var(--text-strong)]">Shared free-tier control plane</h2></div><div className="flex items-center gap-3"><RefreshIndicator refreshing={refreshing} measuredAt={data.measuredAt} /><button type="button" onClick={() => void refresh()} className="btn-secondary min-h-[34px] px-2.5 py-1.5 text-xs" aria-label="Refresh shared hosting statistics"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /></button></div></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map(([label, value, note, Icon]) => <div key={label} className="card min-h-[128px] p-5"><div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]"><span>{label}</span><Icon className="h-4 w-4 text-[var(--text-strong)]" /></div><p className="mt-3 font-mono text-2xl font-bold text-[var(--text-strong)]">{value}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{note}</p></div>)}</div><div className="card flex flex-wrap items-center gap-5 p-4 text-xs text-[var(--text-secondary)]"><span><Server className="mr-1 inline h-3.5 w-3.5" />CPU pool: <strong>{data.status.resources.cpu_limit_cores} vCPU</strong></span><span>Memory pool: <strong>{formatBytes(data.status.resources.memory_limit_bytes)}</strong></span><span>Health: <strong>{data.serverStatus.status}</strong></span><span>Accounting: <strong>{data.storage.freshness.replaceAll('_', ' ')}</strong></span></div><p className="text-[11px] text-[var(--text-muted)]">Aggregate read/write rates are exposed by the Rust tenant metrics endpoint per tenant; this overview does not invent a pool-wide rate.</p></section>;
}
