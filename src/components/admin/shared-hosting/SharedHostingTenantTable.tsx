'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react';
import { formatBytes, tenantStatusLabel } from '@/lib/liorandb-admin/shared-hosting';

export interface SharedTenantRow {
  tenant_id: string;
  external_owner_id: string;
  database_name: string;
  plan: string;
  status: string;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  created_at: number;
  customer: { id: string; email: string; fullName?: string } | null;
}

export default function SharedHostingTenantTable({ initial }: { initial: SharedTenantRow[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filtered = useMemo(() => initial.filter((tenant) => { const q = query.trim().toLowerCase(); return (!q || tenant.tenant_id.toLowerCase().includes(q) || tenant.database_name.toLowerCase().includes(q) || tenant.customer?.email.toLowerCase().includes(q)) && (status === 'ALL' || tenant.status === status); }), [initial, query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <section className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-[var(--text-strong)]">Tenant management</h2><p className="text-xs text-[var(--text-muted)]">Rust-authoritative tenant registry. Credentials are never included in this table.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="input-field h-9 pl-9 text-xs" placeholder="Search tenants" /></div><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="input-field h-9 w-auto text-xs" aria-label="Filter tenants by status"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="QUOTA_EXCEEDED">Quota exceeded</option><option value="FAILED">Failed</option></select></div></div><div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] font-mono uppercase text-[var(--text-muted)]"><tr><th className="px-4 py-3 font-medium">Tenant / Database</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Storage</th><th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{visible.length ? visible.map((tenant) => { const percent = tenant.storage_quota_bytes ? Math.min(100, Math.round((tenant.storage_used_bytes / tenant.storage_quota_bytes) * 100)) : 0; return <tr key={tenant.tenant_id} className="hover:bg-[var(--surface-soft)]"><td className="px-4 py-4"><Link href={`/admin/shared-hosting/${tenant.tenant_id}`} className="font-semibold text-[var(--text-strong)] hover:underline">{tenant.database_name}</Link><span className="mt-1 block max-w-[220px] truncate font-mono text-[10px] text-[var(--text-muted)]">{tenant.tenant_id}</span></td><td className="px-4 py-4"><span className="block font-semibold text-[var(--text-strong)]">{tenant.customer?.fullName || tenant.customer?.email || 'Unlinked customer'}</span><span className="text-[11px] text-[var(--text-muted)]">{tenant.customer?.email || tenant.external_owner_id}</span></td><td className="px-4 py-4"><span className="badge badge-default">{tenant.plan}</span></td><td className="px-4 py-4"><span className="badge badge-default">{tenantStatusLabel(tenant.status)}</span></td><td className="px-4 py-4 font-mono text-[11px]"><span>{formatBytes(tenant.storage_used_bytes)} / {formatBytes(tenant.storage_quota_bytes)}</span><span className="ml-2 text-[var(--text-muted)]">{percent}%</span></td><td className="px-4 py-4 font-mono text-[11px] text-[var(--text-muted)]">{new Date(tenant.created_at).toLocaleDateString('en-IN')}</td><td className="px-4 py-4 text-right"><Link href={`/admin/shared-hosting/${tenant.tenant_id}`} className="btn-secondary inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 text-xs"><MoreHorizontal className="h-3.5 w-3.5" />Manage</Link></td></tr>; }) : <tr><td colSpan={7} className="px-6 py-14 text-center text-xs text-[var(--text-muted)]">No tenants match the current filters.</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-[var(--border)] p-3 text-xs text-[var(--text-muted)]"><span>{filtered.length} tenant(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="btn-secondary min-h-[30px] px-2 py-1 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="font-mono">{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className="btn-secondary min-h-[30px] px-2 py-1 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></button></div></div></div></section>;
}
