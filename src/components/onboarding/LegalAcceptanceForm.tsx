'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
}

export default function LegalAcceptanceForm({ policies }: Props) {
  const router = useRouter();
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(
    new Set(policies.filter((p) => p.accepted).map((p) => p.id))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allAccepted = policies.every((p) => acceptedIds.has(p.id));

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
      {policies.map((policy) => (
        <div key={policy.id} className="card space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-medium text-[var(--text-primary)]">{policy.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Version: {policy.version}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === policy.id ? null : policy.id)}
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors whitespace-nowrap"
            >
              {expandedId === policy.id ? 'Collapse ↑' : 'Read ↓'}
            </button>
          </div>

          {expandedId === policy.id && (
            <div
              className="text-sm text-[var(--text-secondary)] leading-relaxed max-h-64 overflow-y-auto p-4 rounded"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <pre className="whitespace-pre-wrap font-sans">{policy.content}</pre>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedIds.has(policy.id)}
              onChange={() => toggleAccept(policy.id)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              I have read and agree to the{' '}
              <strong className="text-[var(--text-primary)]">{policy.title}</strong>
              {' '}({policy.version})
            </span>
          </label>
        </div>
      ))}

      {error && (
        <div className="alert-banner alert-banner-error text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="alert-banner alert-banner-warning text-sm">
        By clicking &quot;Accept all and continue&quot;, you confirm that you have read and understood each of the above agreements. Your acceptance is recorded with a timestamp and your IP address.
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allAccepted || loading}
        className="btn-primary w-full"
      >
        {loading ? 'Recording acceptance...' : 'Accept all and continue →'}
      </button>

      {!allAccepted && (
        <p className="text-xs text-center text-[var(--text-muted)]">
          You must check all boxes before continuing.
        </p>
      )}
    </div>
  );
}
