'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed. Please try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/resend-otp', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend code.');
        if (data.cooldownSeconds) {
          setResendCooldown(data.cooldownSeconds);
        }
        return;
      }

      setSuccess('A new verification code has been sent to your email.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Verify your email</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          We sent a 6-digit verification code to your email address. Enter it below to verify your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="alert-banner alert-banner-error text-sm" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert-banner alert-banner-success text-sm" role="status">
            {success}
          </div>
        )}

        <div>
          <label className="label mb-3 block">Verification code</label>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-xl font-mono font-semibold rounded-md border focus:outline-none focus:border-[var(--accent)] transition-colors"
                style={{
                  background: 'var(--surface)',
                  borderColor: digit ? 'var(--accent)' : 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || otp.join('').length !== 6}
          className="btn-primary w-full"
        >
          {loading ? 'Verifying...' : 'Verify email'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Didn&apos;t receive the code?{' '}
          <button
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resendLoading
              ? 'Sending...'
              : 'Resend code'}
          </button>
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          The code expires in 10 minutes.
        </p>
      </div>
    </div>
  );
}
