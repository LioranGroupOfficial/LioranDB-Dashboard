'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface PaymentItem {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  billingMonth?: string;
  razorpayPaymentLink?: string;
  submittedReference?: string;
  submittedAt?: string;
  transactionReference?: string;
}

export default function VerifyPaymentModal({ payment }: { payment: PaymentItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [confirmedRef, setConfirmedRef] = useState(payment.submittedReference || payment.transactionReference || '');
  const [notes, setNotes] = useState('');
  const [advanceSub, setAdvanceSub] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          decision,
          transactionReference: confirmedRef,
          verificationNotes: notes,
          advanceSubscription: advanceSub,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed.');
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs px-2.5 py-1"
      >
        <span>Verify / Review</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="card border-[var(--border)] bg-[var(--surface)] max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                  Verify Razorpay Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="alert-banner alert-banner-error text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Customer</span>
                <span className="font-medium text-[var(--text-primary)]">{payment.customerName} ({payment.customerEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Invoice Month</span>
                <span className="text-[var(--text-primary)]">{payment.billingMonth || 'Standard'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Amount</span>
                <span className="font-mono text-emerald-400 font-bold">₹{payment.amount.toLocaleString('en-IN')}</span>
              </div>
              {payment.submittedReference && (
                <div className="flex justify-between items-center pt-1 border-t border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Customer Submitted UTR/Ref:</span>
                  <span className="font-mono bg-[var(--surface)] px-2 py-0.5 rounded-xs border border-[var(--border)] text-amber-300 font-bold">
                    {payment.submittedReference}
                  </span>
                </div>
              )}
              {payment.razorpayPaymentLink && (
                <div className="pt-1">
                  <a
                    href={payment.razorpayPaymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline inline-flex items-center gap-1 text-[11px]"
                  >
                    <span>Inspect Razorpay Payment Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleVerify} className="space-y-3.5 text-xs">
              <div>
                <label className="label">Verification Decision</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="VERIFIED"
                      checked={decision === 'VERIFIED'}
                      onChange={() => setDecision('VERIFIED')}
                      className="accent-emerald-500"
                    />
                    <span className="text-emerald-400 font-medium">Verify &amp; Mark as Paid</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="REJECTED"
                      checked={decision === 'REJECTED'}
                      onChange={() => setDecision('REJECTED')}
                      className="accent-red-500"
                    />
                    <span className="text-red-400 font-medium">Reject Payment</span>
                  </label>
                </div>
              </div>

              {decision === 'VERIFIED' ? (
                <div>
                  <label className="label">Confirmed Razorpay Payment ID / UTR</label>
                  <input
                    type="text"
                    value={confirmedRef}
                    onChange={(e) => setConfirmedRef(e.target.value)}
                    placeholder="e.g. pay_xxxxxxxxxx or Bank UTR"
                    className="input-field font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Rejection Reason (Visible to Customer)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Payment ID not found in Razorpay dashboard"
                    className="input-field"
                    required
                  />
                </div>
              )}

              {decision === 'VERIFIED' && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advanceSub}
                    onChange={(e) => setAdvanceSub(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>Advance customer subscription next due date by 1 month</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={decision === 'VERIFIED' ? 'btn-success text-xs' : 'btn-danger text-xs'}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : decision === 'VERIFIED' ? (
                    'Confirm & Verify Payment'
                  ) : (
                    'Reject Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

