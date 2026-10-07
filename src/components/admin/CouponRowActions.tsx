'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power } from 'lucide-react';

interface Props {
  couponId: string;
  code: string;
  enabled: boolean;
}

export default function CouponRowActions({ couponId, code, enabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    const nextState = !enabled;
    if (!confirm(`${nextState ? 'Enable' : 'Disable'} coupon "${code}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update coupon');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={handleToggle}
        disabled={loading}
        title={enabled ? 'Disable Coupon' : 'Enable Coupon'}
        className={`btn text-xs py-1 px-2 inline-flex items-center gap-1 ${
          enabled
            ? 'btn-secondary text-amber-400 hover:text-amber-300'
            : 'btn-secondary text-emerald-400 hover:text-emerald-300'
        }`}
      >
        <Power className="w-3.5 h-3.5" />
        <span>{enabled ? 'Disable' : 'Enable'}</span>
      </button>
    </div>
  );
}
