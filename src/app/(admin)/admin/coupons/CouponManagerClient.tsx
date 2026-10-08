'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export interface AdminCouponItem {
  _id: string;
  code: string;
  discountPercentage: number;
  enabled: boolean;
  scope: string;
  planIds?: string[];
  expiresAt?: string | null;
  maxRedemptions?: number | null;
  redemptionCount: number;
  createdAt: string;
}

interface Props {
  initialCoupons: AdminCouponItem[];
}

export default function CouponManagerClient({ initialCoupons }: Props) {
  const [coupons, setCoupons] = useState<AdminCouponItem[]>(initialCoupons);
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [scope, setScope] = useState('ALL');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountPercentage: Number(discountPercentage),
          scope,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create coupon');

      setCoupons([data.coupon, ...coupons]);
      setShowModal(false);
      setCode('');
      setDiscountPercentage(10);
      setMaxRedemptions('');
      setExpiresAt('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update coupon');

      setCoupons(coupons.map((c) => (c._id === id ? { ...c, enabled: !currentEnabled } : c)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update coupon');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete coupon');

      setCoupons(coupons.filter((c) => c._id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete coupon');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-medium text-slate-400">Manage Discount Codes</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Coupon</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Discount</th>
                <th className="px-5 py-3 font-medium">Scope</th>
                <th className="px-5 py-3 font-medium">Redemptions</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                    No promotional coupons configured yet.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-white">
                      {c.code}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-emerald-400 font-semibold">
                      {c.discountPercentage}% OFF
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{c.scope}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-300">
                      {c.redemptionCount} {c.maxRedemptions ? `/ ${c.maxRedemptions}` : 'used'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggle(c._id, c.enabled)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors ${
                          c.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {c.enabled ? (
                          <>
                            <CheckCircle className="w-3 h-3" /> Enabled
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Disabled
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c._id)}
                        className="text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-white">Create Discount Coupon</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate promotional percentage discounts for usage invoices.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LAUNCH50"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Discount Percentage (1 - 100%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Plans &amp; Instances</option>
                  <option value="PLAN">Selected Plan Only</option>
                  <option value="CUSTOMER">Selected Customer Only</option>
                  <option value="INSTANCE">Selected Instance Only</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Max Redemptions (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !code}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Coupon'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
