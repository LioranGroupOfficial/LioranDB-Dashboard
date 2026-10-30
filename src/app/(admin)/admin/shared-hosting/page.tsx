import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/guards';
import { getSharedHostingSnapshot, listSharedTenants } from '@/lib/services/shared-hosting.service';
import SharedHostingOverview from '@/components/admin/shared-hosting/SharedHostingOverview';
import SharedHostingTenantTable from '@/components/admin/shared-hosting/SharedHostingTenantTable';
import { AdminTableSkeleton, ErrorWidget } from '@/components/dashboard/skeletons';
import type { SharedHostingOverviewData, } from '@/components/admin/shared-hosting/SharedHostingOverview';
import type { SharedTenantRow } from '@/components/admin/shared-hosting/SharedHostingTenantTable';
import SharedTenantProvisionForm from '@/components/admin/shared-hosting/SharedTenantProvisionForm';
import { connectToDatabase, User } from '@/lib/db';

async function Overview() {
  try { const snapshot = await getSharedHostingSnapshot(); return <SharedHostingOverview initial={snapshot as SharedHostingOverviewData} />; } catch { return <ErrorWidget message="The shared-hosting control plane is unavailable. No capacity values are shown until the backend responds." />; }
}

async function Tenants() {
  try { const tenants = await listSharedTenants(); await connectToDatabase(); const owners = await User.find({ _id: { $in: tenants.map((tenant) => tenant.external_owner_id) } }).select('email profile.fullName').lean(); const ownerById = new Map(owners.map((owner) => [owner._id.toString(), owner])); const rows: SharedTenantRow[] = tenants.map((tenant) => { const owner = ownerById.get(tenant.external_owner_id); return { ...tenant, customer: owner ? { id: owner._id.toString(), email: owner.email, fullName: owner.profile?.fullName } : null }; }); const recent = [...rows].sort((a, b) => b.created_at - a.created_at).slice(0, 5); return <div className="space-y-4"><SharedHostingTenantTable initial={rows} /><div className="card p-5"><h2 className="text-sm font-semibold text-[var(--text-strong)]">Recent provisioning activity</h2><div className="mt-3 space-y-2">{recent.length ? recent.map((tenant) => <div key={tenant.tenant_id} className="flex flex-col justify-between gap-1 border-t border-[var(--border)] pt-2 text-xs sm:flex-row"><span className="font-semibold text-[var(--text-strong)]">{tenant.database_name}</span><span className="font-mono text-[11px] text-[var(--text-muted)]">{new Date(tenant.created_at).toLocaleString('en-IN')} · {tenant.status}</span></div>) : <p className="text-xs text-[var(--text-muted)]">No provisioning activity has been recorded.</p>}</div></div></div>; } catch { return <ErrorWidget message="Tenant registry information is temporarily unavailable." />; }
}

export default async function SharedHostingPage() {
  await requireRole('admin');
  return <div className="mx-auto max-w-7xl space-y-8 pb-16"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Administration</p><h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)] sm:text-3xl">Shared Hosting</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-muted)]">Manage the authoritative Rust free-tier pool, its ten durable tenant slots, and logical storage accounting.</p></div><SharedTenantProvisionForm /></div><Suspense fallback={<div className="space-y-4"><div className="skeleton-ink h-6 w-64" /><AdminTableSkeleton rows={1} /></div>}><Overview /></Suspense><Suspense fallback={<AdminTableSkeleton rows={7} />}><Tenants /></Suspense></div>;
}
