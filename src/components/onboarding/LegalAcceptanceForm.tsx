'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface Policy {
  id: string;
  slug: string;
  title: string;
  version: string;
  content: string;
  accepted: boolean;
}

interface Props {
  policies: Policy[];
  allPreviouslyAccepted?: boolean;
}

export default function LegalAcceptanceForm({ policies, allPreviouslyAccepted = false }: Props) {
  const router = useRouter();
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(
    new Set(policies.filter((p) => p.accepted).map((p) => p.id))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allAccepted = policies.length > 0 && policies.every((p) => acceptedIds.has(p.id));

  function toggleAccept(id: string) {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (allPreviouslyAccepted) {
      router.push('/dashboard');
      return;
    }

    if (!allAccepted) {
      setError('You must read and accept all agreements to continue.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/customer/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyIds: policies.map((p) => p.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Submission failed. Please try again.');
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

  return (
    <div className="max-w-2xl space-y-4">
      {allPreviouslyAccepted && (
        <div className="alert-banner alert-banner-success text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--brand-green)] shrink-0" />
            <span>You have signed all active agreements. Your acceptance record is securely logged.</span>
          </div>
          <Link
            href="/dashboard"
            className="btn-secondary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {policies.map((policy) => (
        <div key={policy.id} className="card space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{policy.title}</h3>
                {policy.accepted && (
                  <span className="badge badge-active text-[10px] font-semibold">Signed</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Version: {policy.version}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === policy.id ? null : policy.id)}
              className="text-xs text-[var(--accent)] hover:underline transition-colors whitespace-nowrap font-semibold"
            >
              {expandedId === policy.id ? 'Collapse ↑' : 'Read Policy ↓'}
            </button>
          </div>

          {expandedId === policy.id && (
            <div
              className="text-xs text-[var(--text-secondary)] leading-relaxed max-h-64 overflow-y-auto p-4 rounded-xl"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{policy.content}</pre>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={acceptedIds.has(policy.id)}
              onChange={() => toggleAccept(policy.id)}
              className="mt-0.5 accent-[var(--accent)] w-4 h-4 rounded-sm cursor-pointer"
            />
            <span className="text-xs text-[var(--text-secondary)] leading-normal">
              I have read and agree to the{' '}
              <strong className="text-[var(--text-primary)]">{policy.title}</strong>
              {' '}({policy.version})
            </span>
          </label>
        </div>
      ))}

      {error && (
        <div className="alert-banner alert-banner-error text-xs" role="alert">
          {error}
        </div>
      )}

      {!allPreviouslyAccepted && (
        <div className="alert-banner alert-banner-warning text-xs">
          By clicking &quot;Accept all and continue&quot;, you confirm that you have read and understood each of the above agreements. Your acceptance is recorded with a secure timestamp and IP verification.
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allAccepted || loading}
        className="btn-primary w-full py-2.5"
      >
        {loading
          ? 'Recording acceptance...'
          : allPreviouslyAccepted
          ? 'Agreements Signed — Return to Dashboard →'
          : 'Accept All & Continue →'}
      </button>

      {!allAccepted && (
        <p className="text-xs text-center text-[var(--text-muted)]">
          You must check all policy boxes before continuing.
        </p>
      )}
    </div>
  );
}
