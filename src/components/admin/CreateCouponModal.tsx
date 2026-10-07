'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Tag } from 'lucide-react';

export default function CreateCouponModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(20);
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'ALL' | 'PLAN' | 'CUSTOMER' | 'INSTANCE'>('ALL');
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        discountPercentage: Number(discountPercentage),
        description: description.trim() || undefined,
        scope,
        planIds: scope === 'PLAN' ? planIds : undefined,
        customerId: scope === 'CUSTOMER' && customerId ? customerId.trim() : undefined,
        instanceId: scope === 'INSTANCE' && instanceId ? instanceId.trim() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      };

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create coupon');

      setOpen(false);
      setCode('');
      setDescription('');
      setMaxRedemptions('');
      setExpiresAt('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating coupon');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="btn btn-primary text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Create Coupon</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Create Discount Coupon</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  required
                  className="input uppercase font-mono text-xs w-full"
                  placeholder="LAUNCH50"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Discount Percentage (1 – 100%) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  className="input text-xs w-full"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  className="input text-xs w-full"
                  placeholder="Early adopter 50% lifetime discount"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Scope *
                </label>
                <select
                  className="input text-xs w-full"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'ALL' | 'PLAN' | 'CUSTOMER' | 'INSTANCE')}
                >
                  <option value="ALL">All Plans &amp; Customers</option>
                  <option value="PLAN">Specific Plan(s)</option>
                  <option value="CUSTOMER">Specific Customer</option>
                  <option value="INSTANCE">Specific Instance</option>
                </select>
              </div>

              {scope === 'PLAN' && (
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Applicable Plans
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planIds.includes('shared')}
                        onChange={(e) => {
                          if (e.target.checked) setPlanIds([...planIds, 'shared']);
                          else setPlanIds(planIds.filter((p) => p !== 'shared'));
                        }}
                      />
                      <span>Shared (₹1/hr)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planIds.includes('dedicated')}
                        onChange={(e) => {
                          if (e.target.checked) setPlanIds([...planIds, 'dedicated']);
                          else setPlanIds(planIds.filter((p) => p !== 'dedicated'));
                        }}
                      />
                      <span>Dedicated (₹8/hr)</span>
                    </label>
                  </div>
                </div>
              )}

              {scope === 'CUSTOMER' && (
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Customer User ID
                  </label>
                  <input
                    type="text"
                    required
                    className="input font-mono text-xs w-full"
                    placeholder="MongoDB User ID"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  />
                </div>
              )}

              {scope === 'INSTANCE' && (
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Database Instance ID
                  </label>
                  <input
                    type="text"
                    required
                    className="input font-mono text-xs w-full"
                    placeholder="MongoDB Database ID"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Max Redemptions (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input text-xs w-full"
                    placeholder="e.g. 100"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="btn btn-primary text-xs"
                >
                  {loading ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
