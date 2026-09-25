'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, AlertTriangle, Wallet, CheckCircle2 } from 'lucide-react';
import { calculateInstanceDeletionRefund } from '@/lib/billing';
import { calculatePlanPrice } from '@/lib/plans';

interface DeleteInstanceButtonProps {
  instanceId: string;
  instanceName: string;
  createdAt?: string | Date;
  monthlyPricePaise?: number;
  planId?: string;
}

export default function DeleteInstanceButton({
  instanceId,
  instanceName,
  createdAt,
  monthlyPricePaise,
  planId,
}: DeleteInstanceButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const basePaise =
    monthlyPricePaise ||
    (planId ? calculatePlanPrice(planId).totalPricePaise : 149900);

  const refundQuote = calculateInstanceDeletionRefund(
    createdAt || new Date(),
    basePaise,
    new Date()
  );

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/instances/${instanceId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete instance.');
      }

      setSuccessMessage(
        data.message ||
          `Instance terminated. A ${refundQuote.refundPercentage}% refund (₹${refundQuote.refundAmountRupees.toFixed(
            2
          )}) has been credited to your wallet.`
      );

      setTimeout(() => {
        router.push('/database');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Deletion failed';
      setError(errStr);
      setLoading(false);
    }
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-500/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Database Instance</span>
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-4 max-w-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Confirm Deletion of &ldquo;{instanceName}&rdquo;</span>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Are you sure you want to terminate this instance? All stored data and provisioned compute resources will be permanently deleted.
          </p>

          {/* Refund Policy Card */}
          <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Instant Wallet Refund Policy</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                  refundQuote.refundPercentage > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                {refundQuote.refundPercentage > 0
                  ? `${refundQuote.refundPercentage}% Refund Eligible`
                  : 'No Refund (> 3 hrs)'}
              </span>
            </div>

            <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
              {refundQuote.refundPercentage > 0 ? (
                <p>
                  Estimated refund amount:{' '}
                  <strong className="text-[var(--color-text-primary)] font-mono">
                    ₹{refundQuote.refundAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>{' '}
                  credited instantly to your wallet.
                </p>
              ) : (
                <p>
                  This instance was created over 3 hours ago. No refund is eligible upon deletion per the refund policy.
                </p>
              )}
            </div>

            {/* Refund Tier Schedule */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] text-center font-mono">
              <div
                className={`p-1.5 rounded border ${
                  refundQuote.refundPercentage === 100
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'
                }`}
              >
                <div>&lt; 15m</div>
                <div className="text-[10px]">100%</div>
              </div>
              <div
                className={`p-1.5 rounded border ${
                  refundQuote.refundPercentage === 90
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'
                }`}
              >
                <div>&lt; 1h</div>
                <div className="text-[10px]">90%</div>
              </div>
              <div
                className={`p-1.5 rounded border ${
                  refundQuote.refundPercentage === 60
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'
                }`}
              >
                <div>1h–3h</div>
                <div className="text-[10px]">60%</div>
              </div>
              <div
                className={`p-1.5 rounded border ${
                  refundQuote.refundPercentage === 0
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'
                }`}
              >
                <div>&gt; 3h</div>
                <div className="text-[10px]">0%</div>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          {successMessage && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !!successMessage}
              className="py-1.5 px-3 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{refundQuote.refundPercentage > 0 ? 'Yes, Terminate & Refund' : 'Yes, Terminate Instance'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={loading || !!successMessage}
              className="py-1.5 px-3 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] text-xs font-medium border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


