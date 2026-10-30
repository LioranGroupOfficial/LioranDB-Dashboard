'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SharedTenantActions({ tenantId, status }: { tenantId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rotatedCredentials, setRotatedCredentials] = useState<{ username?: string; password?: string } | null>(null);
  async function run(action: 'suspend' | 'resume' | 'reset' | 'rotate' | 'delete') {
    const destructive = action === 'reset' || action === 'rotate' || action === 'delete';
    if (destructive && !window.confirm(`Confirm ${action} for this shared tenant? ${action === 'reset' ? 'All tenant database data will be removed.' : action === 'delete' ? 'The tenant and its database will be permanently deleted.' : 'Existing credentials will stop working.'}`)) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/shared-hosting/${encodeURIComponent(tenantId)}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Action failed.');
      const credentials = data.result?.credentials || data.result?.connection;
      if (action === 'rotate' && credentials?.password) setRotatedCredentials({ username: credentials.username, password: credentials.password });
      if (action === 'delete') router.push('/admin/shared-hosting'); else router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Action failed.'); } finally { setBusy(null); }
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">{status === 'SUSPENDED' ? <button type="button" onClick={() => void run('resume')} disabled={Boolean(busy)} className="btn-secondary text-xs">{busy === 'resume' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Resume</button> : <button type="button" onClick={() => void run('suspend')} disabled={Boolean(busy)} className="btn-secondary text-xs">{busy === 'suspend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Suspend</button>}<button type="button" onClick={() => void run('rotate')} disabled={Boolean(busy)} className="btn-secondary text-xs">{busy === 'rotate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Rotate credentials</button><button type="button" onClick={() => void run('reset')} disabled={Boolean(busy)} className="btn-primary text-xs">{busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Reset tenant</button><button type="button" onClick={() => void run('delete')} disabled={Boolean(busy)} className="btn-secondary text-xs text-red-700">{busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Delete tenant</button></div>{rotatedCredentials ? <div className="rounded border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs"><p className="font-semibold text-[var(--text-strong)]">New credentials — copy now</p><p className="mt-1 break-all font-mono text-[var(--text-muted)]">Username: {rotatedCredentials.username || '—'}</p><p className="break-all font-mono text-[var(--text-muted)]">Password: {rotatedCredentials.password}</p></div> : null}</div>;
}
