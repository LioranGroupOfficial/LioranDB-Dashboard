'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomerOption {
  id: string;
  name: string;
  email: string;
  subscriptionId?: string;
}

interface Props {
  customers: CustomerOption[];
}

export default function AttachPaymentLinkModal({ customers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(customers[0]?.id || '');
  const [amount, setAmount] = useState('5000');
  const [currency, setCurrency] = useState('INR');
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  });
  const [razorpayPaymentLink, setRazorpayPaymentLink] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!userId) {
      setError('Please select a customer.');
      return;
    }
    if (!razorpayPaymentLink.trim()) {
      setError('Please provide the Razorpay payment link.');
      return;
    }

    setLoading(true);

    try {
      const selectedCustomer = customers.find((c) => c.id === userId);
      const res = await fetch('/api/admin/billing/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscriptionId: selectedCustomer?.subscriptionId,
          amount: parseFloat(amount) || 5000,
          currency,
          billingMonth,
          dueDate,
          razorpayPaymentLink,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to attach payment link.');
        return;
      }

      setSuccess('Razorpay payment link attached successfully!');
      setTimeout(() => {
        setOpen(false);
        setSuccess('');
        setRazorpayPaymentLink('');
        router.refresh();
      }, 1200);
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
        className="btn-primary text-xs flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Attach Monthly Razorpay Link</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="card border-[var(--border)] bg-[var(--surface)] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <Link2 className="w-5 h-5" />
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Attach Razorpay Monthly Payment Link
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

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="label">Target Customer</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Billing Month / Period</label>
                  <input
                    type="text"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    placeholder="e.g. September 2026"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount (INR)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    disabled
                    className="input-field opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Razorpay Payment URL *
                </label>
                <input
                  type="url"
                  value={razorpayPaymentLink}
                  onChange={(e) => setRazorpayPaymentLink(e.target.value)}
                  placeholder="https://rzp.io/l/xxxxxxxxxx"
                  className="input-field font-mono"
                  required
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Enter the Razorpay payment page or payment button link generated from your Razorpay Dashboard.
                </p>
              </div>

              <div>
                <label className="label">Internal Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Regular monthly subscription invoice"
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
                      <span>Attaching Link...</span>
                    </>
                  ) : (
                    'Attach & Notify Customer'
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

