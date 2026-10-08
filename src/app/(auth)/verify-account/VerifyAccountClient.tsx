'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Check, CreditCard, Lock, Loader2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { loadRazorpaySDK } from '@/lib/razorpay-client';

interface Props {
  userEmail: string;
  isEmailVerified: boolean;
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
  handler: (response: RazorpaySuccessResponse) => Promise<void>;
}

export default function VerifyAccountClient({ userEmail, isEmailVerified }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpaySDK();
      if (!isLoaded) {
        throw new Error('Could not load Razorpay payment gateway. Please check your internet connection.');
      }

      // 2. Create order on backend
      const res = await fetch('/api/account-verification/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize verification order.');
      }

      if (data.verified) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const { orderId, amountPaise, currency, keyId, user } = data;

      // 3. Open Razorpay Checkout modal
      const options: RazorpayOptions = {
        key: keyId,
        amount: amountPaise,
        currency: currency || 'INR',
        name: 'LioranDB Cloud',
        description: 'One-Time ₹30 Account Verification Fee',
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || userEmail,
          contact: user?.phone || '',
        },
        theme: {
          color: '#111111',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setInfoMessage('Payment was cancelled. You can retry whenever you are ready.');
          },
        },
        handler: async (response: RazorpaySuccessResponse) => {
          setLoading(true);
          try {
            const confirmRes = await fetch('/api/account-verification/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) {
              throw new Error(confirmData.error || 'Payment verification failed.');
            }

            // Redirect to dashboard on success
            router.push('/dashboard');
            router.refresh();
          } catch (confirmErr: unknown) {
            const msg = confirmErr instanceof Error ? confirmErr.message : 'Confirmation error';
            setError(msg);
            setLoading(false);
          }
        },
      };

      const rzp = new (window as unknown as { Razorpay: new (opts: RazorpayOptions) => { open: () => void } }).Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected payment error occurred.';
      setError(msg);
      setLoading(false);
    }
  }

  async function handleCheckStatus() {
    setError(null);
    setInfoMessage(null);
    setCheckingStatus(true);

    try {
      const res = await fetch('/api/account-verification/status');
      const data = await res.json();

      if (data.verified) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      setInfoMessage('No completed payment was detected yet. Please click "Pay ₹30 & Verify Account" to complete verification.');
    } catch {
      setError('Unable to check payment status. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 rounded-[10px] bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-strong)] mx-auto flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Verify Your LioranDB Account
        </h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
          Complete a one-time ₹30 account verification payment to activate your account and start using LioranDB Cloud.
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="alert-banner alert-banner-error text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {infoMessage && (
        <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
          <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-muted)]" />
          <div className="flex-1">{infoMessage}</div>
        </div>
      )}

      {/* Verification Summary Checklist */}
      <div className="space-y-2.5 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 text-xs font-mono">
        <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
          <span className="text-[var(--text-muted)]">Email Verification</span>
          <span className="text-[var(--text-strong)] font-semibold inline-flex items-center gap-1">
            {isEmailVerified ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{userEmail}</span>
              </>
            ) : (
              'Unverified'
            )}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
          <span className="text-[var(--text-muted)]">Account Status</span>
          <span className="badge badge-default text-[10px]">
            PENDING VERIFICATION
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-[var(--text-muted)]">One-Time Fee</span>
          <span className="text-sm font-bold text-[var(--text-strong)]">
            ₹30.00
          </span>
        </div>
      </div>

      {/* Clarity Disclaimer */}
      <div className="text-[11px] text-[var(--text-muted)] space-y-1.5 leading-relaxed bg-[var(--surface-2)] p-3 rounded-[7px] border border-[var(--border)]">
        <p className="font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Account Activation Policy</span>
        </p>
        <p>
          This one-time fee activates your LioranDB Cloud account. Database hosting and other services are billed separately.
        </p>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={handlePay}
          disabled={loading || checkingStatus}
          className="btn-primary w-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>Pay ₹30 &amp; Verify Account</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={loading || checkingStatus}
          className="btn-secondary w-full py-2 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {checkingStatus ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Checking Razorpay Status...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check Payment Status</span>
            </>
          )}
        </button>
      </div>

      {/* Footer / Sign Out */}
      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="font-mono text-[10px]">Razorpay 256-Bit TLS</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="hover:text-[var(--text-strong)] inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
