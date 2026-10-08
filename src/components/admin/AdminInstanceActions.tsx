'use client';

import React, { useState } from 'react';
import { Play, Pause, Trash2, Key, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  instanceId: string;
  instanceName: string;
  status: string;
}

export default function AdminInstanceActions({ instanceId, instanceName, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSuspend() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/instances/${instanceId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to suspend instance');
      setShowSuspendModal(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!confirm(`Are you sure you want to resume "${instanceName}"?`)) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/instances/${instanceId}/resume`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume instance');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleTerminate() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/instances/${instanceId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Terminated by administrator' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to terminate instance');
      setShowTerminateModal(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/instances/${instanceId}/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setNewPassword(data.temporaryPassword);
      setShowResetModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center space-x-2">
      {error && <span className="text-xs text-rose-500 mr-2">{error}</span>}

      {status === 'ACTIVE' && (
        <button
          onClick={() => setShowSuspendModal(true)}
          disabled={loading}
          className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
          title="Suspend Instance"
        >
          <Pause className="w-4 h-4" />
        </button>
      )}

      {status === 'SUSPENDED' && (
        <button
          onClick={handleResume}
          disabled={loading}
          className="p-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
          title="Resume Instance"
        >
          <Play className="w-4 h-4" />
        </button>
      )}

      {status !== 'TERMINATED' && (
        <>
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] rounded-lg transition"
            title="Reset Master Password"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTerminateModal(true)}
            disabled={loading}
            className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            title="Terminate Instance"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 text-[var(--text-primary)] shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-strong)]">Suspend Instance</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Suspending <strong className="text-[var(--text-strong)]">{instanceName}</strong> will immediately halt access and stop billing accumulation.
              </p>
            </div>
            <div>
              <label className="label">Reason for suspension</label>
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Non-payment, Terms violation"
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={loading}
                className="btn-secondary !text-amber-500 !border-amber-500/30 hover:!bg-amber-500/10 text-xs py-2 px-4 font-semibold"
              >
                {loading ? 'Suspending...' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-[var(--text-primary)] shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-strong)]">Terminate Instance</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Are you sure you want to permanently terminate <strong className="text-[var(--text-strong)]">{instanceName}</strong>? All data will be erased and the current billing cycle will be closed.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={loading}
                className="btn-primary !bg-rose-600 hover:!bg-rose-500 !text-white text-xs py-2 px-4 font-bold"
              >
                {loading ? 'Terminating...' : 'Terminate Instance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 text-[var(--text-primary)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-strong)]">New Master Password</h3>
              <button onClick={() => setShowResetModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              The master password for <strong className="text-[var(--text-strong)]">{instanceName}</strong> was reset. It is not stored in plaintext and will not be displayed again:
            </p>
            <div className="flex items-center justify-between bg-[var(--surface-soft)] border border-[var(--border)] p-3 rounded-lg font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="truncate mr-2">{newPassword}</span>
              <button
                onClick={handleCopy}
                className="btn-secondary text-xs py-1 px-2.5"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setShowResetModal(false)}
              className="btn-primary w-full py-2.5 text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

