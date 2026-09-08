'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  db: {
    id: string;
    name: string;
    status: string;
    customerEmail: string;
    suspendedAt?: string;
    suspensionReason?: string;
  };
}

export default function DatabaseActions({ db }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSuspend() {
    const reason = prompt('Enter suspension reason (visible to customer):', 'Account or payment review required');
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/provision/${db.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!confirm(`Resume database service for ${db.name}?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/provision/${db.id}/resume`, {
        method: 'POST',
      });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-end gap-2 text-xs">
      {db.status === 'ACTIVE' ? (
        <button
          onClick={handleSuspend}
          disabled={loading}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-full transition-colors"
        >
          {loading ? 'Processing...' : 'Suspend'}
        </button>
      ) : db.status === 'SUSPENDED' ? (
        <button
          onClick={handleResume}
          disabled={loading}
          className="text-xs font-semibold text-[var(--accent)] hover:text-white bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 px-2.5 py-1 rounded-full transition-colors"
        >
          {loading ? 'Processing...' : 'Resume'}
        </button>
      ) : null}
    </div>
  );
}

