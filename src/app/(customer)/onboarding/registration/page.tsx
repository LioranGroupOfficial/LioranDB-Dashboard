'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, ArrowRight, Loader2, Sparkles, Database, Lock, Zap, CreditCard, Coins } from 'lucide-react';
import Script from 'next/script';

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

      // Step 1: Create Topup Order
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

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="min-h-screen bg-[var(--color-surface-sunken)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-mono uppercase tracking-wider mb-4 border border-[var(--color-primary)]/20">
              <Sparkles className="w-3.5 h-3.5" /> Account Activation
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[var(--color-text-primary)] tracking-tight">
              Add your first credits
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Add a minimum of ₹100 to activate your LioranDB account. Your full balance remains available to use for LioranDB services.
            </p>
          </div>

          {/* Card */}
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl shadow-xs overflow-hidden">
            {/* Amount Selection */}
            <div className="p-6 sm:p-8 border-b border-[var(--color-border-subtle)] space-y-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Select Initial Credit Amount (Min ₹100)
              </label>

              <div className="grid grid-cols-4 gap-2">
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
                      className={`py-2.5 px-3 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                          : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-text-tertiary)]'
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
                  className="text-xs text-[var(--color-primary)] hover:underline font-mono"
                >
                  {isCustom ? '← Choose preset amount' : '+ Enter custom amount'}
                </button>

                {isCustom && (
                  <div className="pt-2">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--color-text-tertiary)]">
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
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">Initial Account Balance:</span>
                <span className="font-serif text-2xl font-bold text-[var(--color-text-primary)]">
                  ₹{effectiveAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="p-6 sm:p-8 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                What’s unlocked with your credit balance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Zero-Checkout Deployments</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Launch instances instantly using your credits with no repetitive card checkouts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Full Balance Preserved</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Every single rupee you deposit stays in your wallet for database compute &amp; backups.
                    </p>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                  {errorMessage}
                </div>
              )}

              {success && (
                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Credits verified &amp; added! Redirecting to your dashboard...</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handlePayInitialCredit}
                  disabled={loading || success || effectiveAmount < 100}
                  className="w-full py-3.5 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                      <span>Add ₹{effectiveAmount.toLocaleString('en-IN')} Credit</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[var(--color-text-tertiary)] font-mono">
                <Lock className="w-3 h-3" />
                <span>Secured via Razorpay • 100% Usable Account Balance</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
