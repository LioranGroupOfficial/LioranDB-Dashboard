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
        className="py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-500/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Cancel Database Service</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-card)] border border-red-500/30 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-semibold text-base">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Cancel Database Service</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <p>
                You are about to permanently terminate instance <strong className="font-mono text-[var(--text-primary)]">&ldquo;{instanceName}&rdquo;</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[var(--muted)] pt-1">
                <li>Hourly usage billing will immediately stop once termination completes.</li>
                <li>Database connection access will be revoked immediately.</li>
                <li>All stored documents and backups will be purged according to retention policy.</li>
              </ul>
            </div>

            <form onSubmit={handleCancelService} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Type <span className="font-bold text-[var(--text-primary)] select-all font-mono">&ldquo;{instanceName}&rdquo;</span> to confirm:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={instanceName}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)] focus:outline-hidden focus:border-red-500 transition-colors"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="py-2 px-4 rounded-lg bg-[var(--surface-2)] text-xs text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
                >
                  Keep Instance
                </button>
                <button
                  type="submit"
                  disabled={loading || !isMatched}
                  className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
