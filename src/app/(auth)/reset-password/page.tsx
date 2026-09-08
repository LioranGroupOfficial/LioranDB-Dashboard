'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { KeyRound, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Invalid Reset Link</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
          This password reset link is invalid or has expired. Please request a new recovery link.
        </p>
        <Link href="/forgot-password" className="btn-primary inline-flex items-center gap-1.5 py-2 text-xs">
          <span>Request New Link</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Password reset failed. Please try again.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--brand-green)]/15 border border-[var(--brand-green)]/40 text-[var(--brand-green)] mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Password Reset Successfully</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-6">
          Your credentials have been updated. Redirecting to sign in...
        </p>
        <Link href="/login" className="btn-primary inline-flex items-center gap-1.5 py-2 text-xs">
          <span>Sign In Immediately</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--brand-green)] flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Set New Password</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Create a strong password for your LioranDB account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="alert-banner alert-banner-error text-xs" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="password" className="label flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            New Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••••••"
          />
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Min 10 characters with uppercase, lowercase, digit, &amp; symbol
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2 py-2.5">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating Password...</span>
            </>
          ) : (
            <>
              <span>Reset &amp; Save Password</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="card p-6 text-center text-xs text-[var(--text-secondary)]">Loading recovery interface...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
