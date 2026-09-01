'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ExternalLink, Loader2, AlertCircle, CheckCircle2, Send } from 'lucide-react';

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  billingMonth?: string;
  razorpayPaymentLink?: string;
  status: string;
  submittedReference?: string;
}

export default function SubmitPaymentProofModal({ payment }: { payment: PaymentData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState(payment.submittedReference || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError('Please provide your Razorpay Payment ID or Transaction Reference.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/customer/billing/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          submittedReference: reference.trim(),
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit payment reference.');
        return;
      }

      setSuccess('Payment details submitted! Admin will verify shortly.');
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
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
        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{payment.status === 'SUBMITTED' ? 'Update Submitted Proof' : 'Submit Payment Proof'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="card border-[var(--border)] bg-[var(--surface)] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Submit Razorpay Payment Proof
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
            {success && (
              <div className="alert-banner alert-banner-success text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Invoice</span>
                <span className="text-[var(--text-primary)] font-medium">{payment.billingMonth || 'Monthly Hosting'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Amount</span>
                <span className="font-mono text-emerald-400 font-bold">₹{payment.amount.toLocaleString('en-IN')}</span>
              </div>
              {payment.razorpayPaymentLink && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <a
                    href={payment.razorpayPaymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full py-1.5 text-xs text-center flex items-center justify-center gap-1.5"
                  >
                    <span>Open Razorpay Payment Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="label">
                  Razorpay Payment ID / Transaction UTR *
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. pay_Nxxxxxxxxxxx or UTR Reference"
                  className="input-field font-mono"
                  required
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  After completing the payment on Razorpay, paste the Payment ID (starts with pay_) or bank UTR reference here.
                </p>
              </div>

              <div>
                <label className="label">Optional Note</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid via UPI / Card"
                  className="input-field"
                />
              </div>

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
                  className="btn-primary text-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    'Submit for Admin Verification'
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

