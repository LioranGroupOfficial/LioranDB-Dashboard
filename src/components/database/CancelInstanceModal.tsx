'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

interface Props {
  instanceId: string;
  instanceName: string;
}

export default function CancelInstanceModal({ instanceId, instanceName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMatched = typedName.trim() === instanceName;

  const handleCancelService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/instances/${instanceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typedName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel database service');
      }

      setOpen(false);
      router.push('/database');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTypedName('');
          setError('');
        }}
        className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-2 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Cancel Database Service</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-[var(--text-strong)] font-bold text-base">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Cancel Database Service</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <p>
                You are about to permanently terminate instance <strong className="font-mono text-[var(--text-strong)]">&ldquo;{instanceName}&rdquo;</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[var(--text-muted)] pt-1">
                <li>Hourly usage billing will immediately stop once termination completes.</li>
                <li>Database connection access will be revoked immediately.</li>
                <li>All stored documents and backups will be purged according to retention policy.</li>
              </ul>
            </div>

            <form onSubmit={handleCancelService} className="space-y-4 pt-2">
              <div>
                <label className="label mb-1.5">
                  Type <span className="font-bold text-[var(--text-strong)] select-all font-mono">&ldquo;{instanceName}&rdquo;</span> to confirm:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={instanceName}
                  required
                  className="input-field font-mono text-xs"
                />
              </div>

              {error && (
                <div className="p-3 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-strong)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Keep Instance
                </button>
                <button
                  type="submit"
                  disabled={loading || !isMatched}
                  className="btn-primary text-xs py-2 px-4 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Cancellation &amp; Stop Billing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
