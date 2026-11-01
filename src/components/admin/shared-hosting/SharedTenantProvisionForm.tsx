'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SharedTenantProvisionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/admin/shared-hosting', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `admin-${crypto.randomUUID()}` }, body: JSON.stringify({ external_owner_id: ownerId.trim(), plan: 'free' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Provisioning failed.'); if (data.credentials) setSecret(data.credentials); setOpen(false); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Provisioning failed.'); } finally { setBusy(false); } }
  return <><button type="button" onClick={() => setOpen(true)} className="btn-primary text-xs"><Plus className="h-3.5 w-3.5" />Provision tenant</button>{open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="card w-full max-w-md space-y-4 p-6"><div><h2 className="text-lg font-bold text-[var(--text-strong)]">Provision Free Shared tenant</h2><p className="mt-1 text-xs text-[var(--text-muted)]">The Rust control plane will enforce capacity, ownership, and the 512 MiB quota. A unique instance name will be generated automatically.</p></div><form onSubmit={submit} className="space-y-3"><label className="label">Customer user ID<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} required className="input-field mt-1 text-xs" /></label>{error ? <p role="alert" className="border border-[var(--border)] p-3 text-xs">{error}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3"><button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs">Cancel</button><button type="submit" disabled={busy} className="btn-primary text-xs">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Provision</button></div></form></div></div> : null}{secret ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="card w-full max-w-md space-y-4 p-6"><h2 className="text-lg font-bold text-[var(--text-strong)]">Save tenant credentials</h2><p className="text-xs text-[var(--text-muted)]">This secret is shown once by the control plane response.</p><p className="break-all border border-[var(--border)] bg-[var(--surface-soft)] p-3 font-mono text-xs">{secret.username}:{secret.password}</p><button type="button" onClick={() => setSecret(null)} className="btn-primary w-full text-xs">I have saved this secret</button></div></div> : null}</>;
}
