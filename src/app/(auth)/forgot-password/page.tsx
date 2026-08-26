'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always show success to prevent email enumeration
      if (res.ok || res.status === 429) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Check your email</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            If an account exists with the email address you entered, we&apos;ve sent a password reset link.
            The link expires in 1 hour.
          </p>
        </div>
        <div className="alert-banner alert-banner-info text-sm">
          Check your spam folder if you don&apos;t see the email within a few minutes.
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Reset password</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="alert-banner alert-banner-error text-sm" role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@example.com"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
