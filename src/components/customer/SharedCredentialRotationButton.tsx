'use client';

import { useState } from 'react';
import { Copy, KeyRound, Loader2 } from 'lucide-react';

export default function SharedCredentialRotationButton({ tenantId }: { tenantId: string }) {
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  async function rotate() { if (!window.confirm('Rotate the shared database credentials? Existing credentials will stop working immediately.')) return; setBusy(true); try { const response = await fetch(`/api/customer/free-tier/${encodeURIComponent(tenantId)}/credentials`, { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Credential rotation failed.'); setSecret(data.credentials.credentials || data.credentials); } catch (error) { window.alert(error instanceof Error ? error.message : 'Credential rotation failed.'); } finally { setBusy(false); } }
  return <div className="space-y-3"><button type="button" onClick={() => void rotate()} disabled={busy} className="btn-secondary text-xs">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}Rotate credentials</button>{secret ? <div className="border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs"><p className="font-semibold text-[var(--text-strong)]">Save these credentials now</p><p className="mt-1 font-mono break-all">{secret.username}:{secret.password}</p><button type="button" onClick={() => void navigator.clipboard.writeText(`${secret.username}:${secret.password}`)} className="btn-secondary mt-2 min-h-[30px] px-2 py-1 text-[11px]"><Copy className="h-3 w-3" />Copy</button></div> : null}</div>;
}
