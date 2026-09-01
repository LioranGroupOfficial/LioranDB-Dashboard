'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Sub {
  id: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  currency: string;
}

export default function RecordPaymentModal({ subscription }: { subscription: Sub }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    amount: String(subscription.amount || 5000),
    currency: subscription.currency || 'INR',
    transactionReference: '',
    notes: 'Monthly hosting fee paid via bank transfer',
    advanceNextDue: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          amount: Number(form.amount),
          currency: form.currency,
          transactionReference: form.transactionReference || undefined,
          notes: form.notes,
          advanceNextDue: form.advanceNextDue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to record payment.');
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs px-2.5 py-1">
        Record Payment
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="card w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Record Offline Payment</h3>
                <p className="text-xs text-[var(--text-secondary)]">For {subscription.customerName} ({subscription.customerEmail})</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="alert-banner alert-banner-error text-xs" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Transaction Reference (Bank / UPI / UTR #)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. UTR123456789 or INV-2026-001"
                  value={form.transactionReference}
                  onChange={(e) => setForm({ ...form, transactionReference: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Notes / Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.advanceNextDue}
                  onChange={(e) => setForm({ ...form, advanceNextDue: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                Advance next payment due date to 1st of next month (IST)
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

