'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import {
  CreditCard,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const PRESET_AMOUNTS = [100, 500, 1000, 2500, 5000];

interface AddCreditsModalProps {
  buttonText?: string;
  className?: string;
  initialAmount?: number;
  onSuccess?: (newBalancePaise: number) => void;
}

export default function AddCreditsModal({
  buttonText = 'Add Credits',
  className = '',
  initialAmount = 500,
  onSuccess,
}: AddCreditsModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(initialAmount);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const effectiveAmountRupees = isCustom
    ? parseInt(customAmount, 10) || 0
    : selectedAmount;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setErrorMessage('');
  };

  const handleCustomChange = (val: string) => {
    setCustomAmount(val);
    setIsCustom(true);
    setErrorMessage('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setErrorMessage('');
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  const handleTopup = async () => {
    try {
      if (effectiveAmountRupees < 100) {
        setErrorMessage('Minimum credit top-up is ₹100.');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      // Step 1: Create Order on backend
      const res = await fetch('/api/wallet/topup/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountRupees: effectiveAmountRupees,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create top-up order.');
      }

      const { orderId, amountPaise, currency, keyId, user } = data;

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // Step 2: Open Razorpay modal
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: currency || 'INR',
        name: 'LioranDB Credits',
        description: `Add ₹${effectiveAmountRupees.toLocaleString('en-IN')} LioranDB Credits`,
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
            // Step 3: Verify HMAC and credit wallet
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
            if (onSuccess) {
              onSuccess(verifyData.balancePaise);
            }

            setTimeout(() => {
              setIsOpen(false);
              setSuccess(false);
              setLoading(false);
              router.refresh();
            }, 1200);
          } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : 'Verification failed.';
            setErrorMessage(errStr);
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Failed to initiate payment.';
      setErrorMessage(errStr);
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          'inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-xs font-medium transition-all shadow-xs cursor-pointer'
        }
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl shadow-xl w-full max-w-md p-6 relative space-y-5">
            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="absolute top-4 right-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-mono mb-2">
                <Sparkles className="w-3 h-3" /> Prepaid Balance
              </div>
              <h3 className="font-serif text-2xl font-normal text-[var(--color-text-primary)]">
                Add LioranDB Credits
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Top up your account balance using Razorpay. Credits are used to deploy and auto-renew your managed database instances.
              </p>
            </div>

            {/* Preset Amount Grid */}
            <div className="space-y-3">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Select Credit Amount
              </label>

              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const isCurrent = !isCustom && selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs ring-2 ring-[var(--primary)]/20'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    isCustom
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs ring-2 ring-[var(--primary)]/20'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  Custom
                </button>
              </div>

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
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="Enter amount (min ₹100)"
                      autoFocus
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <span className="text-[11px] text-[var(--color-text-tertiary)] mt-1 block">
                    Minimum top-up: ₹100
                  </span>
                </div>
              )}
            </div>

            {/* Price Preview */}
            <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--color-text-secondary)]">Amount to Pay:</span>
              <span className="font-serif text-lg font-bold text-[var(--color-text-primary)]">
                ₹{effectiveAmountRupees.toLocaleString('en-IN')}
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Payment verified! Credits added to your account.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTopup}
                disabled={loading || success || effectiveAmountRupees < 100}
                className="w-full py-2.5 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Credits Added</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay ₹{effectiveAmountRupees.toLocaleString('en-IN')} with Razorpay</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)] font-mono">
                <Lock className="w-3 h-3" />
                <span>Secured via Razorpay • Instant Wallet Credit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

