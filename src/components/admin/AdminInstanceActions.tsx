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
      {error && <span className="text-xs text-red-500 mr-2">{error}</span>}

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
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
            title="Reset Master Password"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTerminateModal(true)}
            disabled={loading}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
            title="Terminate Instance"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Suspend Instance</h3>
            <p className="text-sm text-slate-400 mb-4">
              Suspending <strong>{instanceName}</strong> will immediately halt access and stop billing accumulation.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Reason for suspension</label>
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Non-payment, Terms violation"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
              >
                {loading ? 'Suspending...' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Terminate Instance</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure you want to permanently terminate <strong>{instanceName}</strong>? All data will be erased and the current billing cycle will be closed.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                {loading ? 'Terminating...' : 'Terminate Instance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-white">New Master Password</h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              The master password for <strong>{instanceName}</strong> was reset. It is not stored in plaintext and will not be displayed again:
            </p>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3 rounded-lg mb-4 font-mono text-sm text-emerald-400">
              <span className="truncate mr-2">{newPassword}</span>
              <button
                onClick={handleCopy}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setShowResetModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

