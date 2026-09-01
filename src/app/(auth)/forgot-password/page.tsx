'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, Loader2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

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
      <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6 text-center">
        <div className="w-12 h-12 rounded-sm bg-emerald-950 border border-emerald-800 text-emerald-400 mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Check Your Email</h1>
        <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
          If an account exists with <span className="text-[var(--text-primary)] font-mono">{email}</span>, we&apos;ve sent password reset instructions. The link expires in 1 hour.
        </p>
        <div className="alert-banner alert-banner-info text-xs mt-4 text-left">
          Please check your spam or junk folder if the link does not arrive within 2 minutes.
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className="btn-secondary w-full py-2 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-[var(--border)] shadow-xl bg-[var(--surface)] p-6">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-sm bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Reset Password</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Enter your registered email address and we&apos;ll send recovery instructions.
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
          <label htmlFor="email" className="label flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Registered Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="developer@company.com"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2 py-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending Instructions...</span>
            </>
          ) : (
            <>
              <span>Send Recovery Link</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-[var(--border)] text-center">
        <Link
          href="/login"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

