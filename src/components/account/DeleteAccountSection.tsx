'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, AlertTriangle, ShieldAlert, CheckCircle2, Loader2, Database, Receipt, DollarSign, Clock } from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

interface Props {
  unpaidInvoicesCount: number;
  unpaidInvoicesTotalPaise: number;
  activeDatabasesCount: number;
  activeDatabaseNames: string[];
  unbilledAccruedPaise: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
}

export default function DeleteAccountSection({
  unpaidInvoicesCount,
  unpaidInvoicesTotalPaise,
  activeDatabasesCount,
  activeDatabaseNames,
  unbilledAccruedPaise,
  pendingPaymentsCount,
  pendingPaymentsTotal,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete =
    unpaidInvoicesCount === 0 &&
    activeDatabasesCount === 0 &&
    unbilledAccruedPaise === 0 &&
    pendingPaymentsCount === 0;

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
    <div className="card border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-strong)] uppercase tracking-wider flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            Permanently remove your account and all associated data from the database.
            Account deletion is only permitted when you have no running databases, no pending invoices, and a ₹0 unbilled balance.
          </p>
        </div>
      </div>

      {!canDelete ? (
        <div className="mt-4 p-4 rounded-[7px] border border-[var(--border-strong)] bg-[var(--surface-soft)] space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-[var(--text-strong)]">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--text-strong)]" />
            <span>Account Deletion Blocked</span>
          </div>

          <p className="text-[var(--text-secondary)]">
            You cannot delete your account until the following requirements are cleared:
          </p>

          <div className="space-y-2 pt-1">
            {/* Running Databases */}
            {activeDatabasesCount > 0 && (
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-[5px] bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-strong)] block">
                      {activeDatabasesCount} Active / Running Database(s)
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {activeDatabaseNames.join(', ')}
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Terminate all active databases before closing your account.
                    </p>
                  </div>
                </div>
                <Link
                  href="/database"
                  className="btn-secondary text-[11px] py-1 px-2.5 shrink-0 whitespace-nowrap self-center"
                >
                  Manage Databases →
                </Link>
              </div>
            )}

            {/* Unpaid Invoices */}
            {unpaidInvoicesCount > 0 && (
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-[5px] bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-start gap-2">
                  <Receipt className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-strong)] block">
                      {unpaidInvoicesCount} Unpaid Invoice(s) ({formatPaiseToRupees(unpaidInvoicesTotalPaise)})
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      All outstanding invoices must be settled before account deletion.
                    </p>
                  </div>
                </div>
                <Link
                  href="/billing"
                  className="btn-secondary text-[11px] py-1 px-2.5 shrink-0 whitespace-nowrap self-center"
                >
                  Pay Invoices →
                </Link>
              </div>
            )}

            {/* Unbilled Accrued Usage */}
            {unbilledAccruedPaise > 0 && (
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-[5px] bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-strong)] block">
                      Unbilled Accrued Usage ({formatPaiseToRupees(unbilledAccruedPaise)})
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      You have accrued database runtime usage for this cycle.
                    </p>
                  </div>
                </div>
                <Link
                  href="/billing"
                  className="btn-secondary text-[11px] py-1 px-2.5 shrink-0 whitespace-nowrap self-center"
                >
                  View Usage →
                </Link>
              </div>
            )}

            {/* Pending Payments */}
            {pendingPaymentsCount > 0 && (
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-[5px] bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-strong)] block">
                      {pendingPaymentsCount} Payment(s) In-Progress (₹{pendingPaymentsTotal.toLocaleString('en-IN')})
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Wait for payment confirmation to complete.
                    </p>
                  </div>
                </div>
                <Link
                  href="/billing"
                  className="btn-secondary text-[11px] py-1 px-2.5 shrink-0 whitespace-nowrap self-center"
                >
                  Check Billing →
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-strong)] shrink-0" />
            <span>All databases terminated, invoices cleared, and ₹0 balance. You are eligible to close this account.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-secondary text-xs px-4 py-2 shrink-0 self-start sm:self-auto cursor-pointer inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="card border-[var(--border)] bg-[var(--surface)] max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-[var(--text-strong)] font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <h3>Confirm Account Deletion</h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This action is permanent and cannot be undone. All associated account data, logs, and active sessions will be permanently purged.
            </p>

            {error && (
              <div className="alert-banner alert-banner-error text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="label text-xs mb-1.5">
                Type <span className="font-mono text-[var(--text-strong)] font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="input-field font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setConfirmationInput('');
                  setError('');
                }}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || confirmationInput !== 'DELETE'}
                className="btn-primary text-xs py-2 px-4 disabled:opacity-50 inline-flex items-center gap-1.5"
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
