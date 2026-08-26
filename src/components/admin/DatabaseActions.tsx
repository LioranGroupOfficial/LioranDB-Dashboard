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
          className="text-red-400 hover:underline"
        >
          Suspend
        </button>
      ) : db.status === 'SUSPENDED' ? (
        <button
          onClick={handleResume}
          disabled={loading}
          className="text-green-400 hover:underline"
        >
          Resume
        </button>
      ) : null}
    </div>
  );
}

