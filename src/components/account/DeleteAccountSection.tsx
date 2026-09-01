'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, AlertTriangle, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

interface Props {
  hasPendingPayments: boolean;
  pendingCount: number;
  pendingTotal: number;
}

export default function DeleteAccountSection({
  hasPendingPayments,
  pendingCount,
  pendingTotal,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (confirmationInput !== 'DELETE') {
      setError('Please type DELETE exactly to confirm.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customer/account/delete', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to delete account.');
        return;
      }

      window.location.href = '/login';
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card border-red-900/40 bg-[#140D0D]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete Account
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            Permanently remove your account and all associated data from the database.
            Account deletion is only permitted after settling all monthly hosting invoices.
          </p>
        </div>
      </div>

      {hasPendingPayments ? (
        <div className="alert-banner alert-banner-warning mt-4 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block">Outstanding Invoices Detected</span>
            <span>
              You have {pendingCount} unpaid invoice(s) totaling ₹{pendingTotal.toLocaleString('en-IN')}. All pending invoices must be paid and verified before your account can be deleted.{' '}
            </span>
            <Link href="/billing" className="text-[var(--accent)] underline font-medium ml-1">
              Go to Billing →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-xs text-emerald-400/90 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>All invoices cleared. You are eligible to close this account.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-danger text-xs px-3 py-1.5 shrink-0 self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="card border-red-800 bg-[var(--surface)] max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-semibold">Confirm Account Deletion</h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This action is permanent and cannot be undone. All active database nodes will be terminated, backups will be purged, and your active session will be invalidated.
            </p>

            {error && (
              <div className="alert-banner alert-banner-error text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="label text-xs">
                Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="input-field font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setConfirmationInput('');
                  setError('');
                }}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || confirmationInput !== 'DELETE'}
                className="btn-danger text-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Permanently Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

