'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, Loader2, Sparkles, Lock, CreditCard } from 'lucide-react';
import Script from 'next/script';
import { loadRazorpaySDK } from '@/lib/razorpay-client';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const PRESET_TOPUPS = [100, 500, 1000, 2500];

export default function InitialTopupOnboardingPage() {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const effectiveAmount = isCustom ? parseInt(customAmount, 10) || 0 : selectedAmount;

  const handlePayInitialCredit = async () => {
    try {
      if (effectiveAmount < 100) {
        setErrorMessage('Minimum initial top-up is ₹100.');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      // Step 1: Ensure Razorpay SDK is loaded
      const sdkLoaded = await loadRazorpaySDK();
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection or disable ad blockers.');
      }

      // Step 2: Create Topup Order
      const res = await fetch('/api/wallet/topup/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees: effectiveAmount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate order.');
      }

      const { orderId, amountPaise, currency, keyId, user } = data;

      // Step 2: Open Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: currency || 'INR',
        name: 'LioranDB Credits',
        description: `Add ₹${effectiveAmount.toLocaleString('en-IN')} Initial Credits`,
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#cc785c',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setLoading(true);
            // Step 3: Verify server-side HMAC & credit wallet
            const verifyRes = await fetch('/api/wallet/topup/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment signature verification failed.');
            }

            setSuccess(true);
            setTimeout(() => {
              router.push('/dashboard');
            }, 1200);
          } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : 'Payment verification failed.';
            setErrorMessage(errStr);
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrorMessage(errStr);
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-mono uppercase tracking-wider mb-3 border border-[var(--primary)]/20">
              <Sparkles className="w-3.5 h-3.5" /> Account Activation
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[var(--text-primary)] tracking-tight">
              Add your first credits
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
              Add at least ₹100 to activate your LioranDB account. Your entire balance can be used for LioranDB services.
            </p>
          </div>

          {/* Card */}
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            {/* Amount Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)]">
                Select Credit Amount
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_TOPUPS.map((amt) => {
                  const isCurrent = !isCustom && selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setIsCustom(false);
                        setErrorMessage('');
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs ring-2 ring-[var(--primary)]/20'
                          : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-xs text-[var(--primary)] hover:underline font-mono cursor-pointer"
                >
                  {isCustom ? '← Choose preset amount' : '+ Enter custom amount'}
                </button>

                {isCustom && (
                  <div className="pt-2">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--muted)]">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={100}
                        step={50}
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setErrorMessage('');
                        }}
                        placeholder="Enter amount (min 100)"
                        autoFocus
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] font-mono focus:outline-hidden focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Price Preview */}
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">You&apos;ll receive:</span>
                <span className="text-[11px] text-[var(--muted)]">100% spendable credit</span>
              </div>
              <span className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                ₹{effectiveAmount.toLocaleString('en-IN')} Credits
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {errorMessage}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Credits added! Redirecting to your dashboard...</span>
              </div>
            )}

            {/* Action Button */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handlePayInitialCredit}
                disabled={loading || success || effectiveAmount < 100}
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Credits Added</span>
                  </>
                ) : (
                  <>
                    <span>Add ₹{effectiveAmount.toLocaleString('en-IN')} Credits</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--muted)] font-mono">
                <Lock className="w-3 h-3" />
                <span>Secured by Razorpay • Developer Console</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
