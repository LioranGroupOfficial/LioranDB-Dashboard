'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, ArrowRight, Loader2, Sparkles, Database, Lock, Zap } from 'lucide-react';
import Script from 'next/script';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export default function RegistrationPaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePayRegistration = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      // Step 1: Create Order
      const res = await fetch('/api/billing/registration/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate registration order.');
      }

      if (data.alreadyPaid) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
        return;
      }

      const { orderId, amount, currency, keyId, user } = data;

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection and retry.');
      }

      // Step 2: Open Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'LioranDB',
        description: 'One-time Account Registration Fee (₹100)',
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#cc785c', // Claude accent token
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
            // Step 3: Verify server-side HMAC
            const verifyRes = await fetch('/api/billing/registration/verify', {
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
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-[var(--color-surface-sunken)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-mono uppercase tracking-wider mb-4 border border-[var(--color-primary)]/20">
              <Sparkles className="w-3.5 h-3.5" /> Account Activation
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[var(--color-text-primary)] tracking-tight">
              LioranDB Account Registration
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Complete your one-time registration fee to unlock database provisioning and full dashboard access.
            </p>
          </div>

          {/* Card */}
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl shadow-xs overflow-hidden">
            {/* Price Banner */}
            <div className="p-6 sm:p-8 border-b border-[var(--color-border-subtle)] bg-gradient-to-b from-[var(--color-primary)]/[0.03] to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                    One-Time Registration Fee
                  </h2>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Covers account identity validation & anti-abuse verification
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="font-serif text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
                    ₹100
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)] block">
                    One-time payment
                  </span>
                </div>
              </div>
            </div>

            {/* Feature List */}
            <div className="p-6 sm:p-8 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                What’s unlocked with your registration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Instant Provisioning</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Deploy shared & dedicated LioranDB managed instances in seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Full Dashboard Access</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Telemetry, connection strings, plan management, and backups.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Zero Trust Encryption</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      AES-256-GCM credential isolation and TLS 1.3 endpoints.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary)]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Direct Developer Support</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Ticketing, priority diagnostics, and status updates.
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
                  <span>Payment verified successfully! Redirecting to your dashboard...</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handlePayRegistration}
                  disabled={loading || success}
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
                      <span>Registration Active</span>
                    </>
                  ) : (
                    <>
                      <span>Register Account — ₹100</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[var(--color-text-tertiary)] font-mono">
                <Lock className="w-3 h-3" />
                <span>Secured by Razorpay • Test Mode Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
