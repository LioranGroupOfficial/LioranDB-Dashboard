'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MinusCircle, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AdminWalletAdjustModalProps {
  targetUserId: string;
  targetUserEmail: string;
  currentBalanceRupees: number;
}

export default function AdminWalletAdjustModal({
  targetUserId,
  targetUserEmail,
  currentBalanceRupees,
}: AdminWalletAdjustModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCredit, setIsCredit] = useState(true);
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountRupees);
    if (!num || num <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError('A descriptive reason (at least 3 characters) is required.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          amountRupees: num,
          isCredit,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust wallet balance.');
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setLoading(false);
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Adjustment failed';
      setError(errStr);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="py-1 px-2.5 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
      >
        Adjust Credits
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl shadow-xl w-full max-w-md p-6 relative space-y-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="absolute top-4 right-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="font-serif text-xl font-normal text-[var(--color-text-primary)]">
                Admin Credit Adjustment
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Adjust balance for <span className="font-mono text-[var(--color-text-primary)]">{targetUserEmail}</span>
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Current Balance: ₹{currentBalanceRupees.toLocaleString('en-IN')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCredit(true)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                    isCredit
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Credit (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCredit(false)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isCredit
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-semibold'
                      : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Debit (-)</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-sm font-mono text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                  Mandatory Reason (Audited)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Promotional goodwill credit for beta testing feedback"
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Adjustment recorded in ledger.</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="py-2 px-3.5 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || success}
                  className="py-2 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-xs font-medium cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

