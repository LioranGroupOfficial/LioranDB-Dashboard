'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Invalid reset link</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          This password reset link is invalid or has expired.{' '}
          <Link href="/forgot-password" className="text-[var(--accent)]">
            Request a new one
          </Link>
          .
        </p>
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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Password reset</h1>
        <div className="alert-banner alert-banner-success text-sm mb-4">
          Your password has been reset successfully. Redirecting to sign in...
        </div>
        <Link href="/login" className="btn-primary inline-block">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Set new password</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="alert-banner alert-banner-error text-sm" role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="label">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••••"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Minimum 10 characters with uppercase, lowercase, digit, and special character
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-secondary)]">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
