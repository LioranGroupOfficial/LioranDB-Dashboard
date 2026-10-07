'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { PLANS, SUPPORT_CONTACT_EMAIL, formatPaiseToRupees } from '@/lib/plans';

export default function CreateInstancePage() {

  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<'shared' | 'dedicated'>('shared');
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercentage: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdResult, setCreatedResult] = useState<{
    id: string;
    name: string;
    username: string;
    password?: string;
    host: string;
    port: number;
    databaseName: string;
  } | null>(null);

  const selectedPlan = PLANS[selectedPlanId];

  // Validate coupon
  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          planId: selectedPlanId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid coupon code');
      }
      setAppliedCoupon({
        code: data.code,
        discountPercentage: data.discountPercentage,
      });
    } catch (err: unknown) {
      setAppliedCoupon(null);
      setCouponError(err instanceof Error ? err.message : 'Coupon validation failed');
    } finally {
      setCouponLoading(false);
    }
  }

  // Create instance
  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceName.trim()) {
      setErrorMessage('Please enter an instance name');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: instanceName.trim(),
          planId: selectedPlanId,
          backupEnabled,
          couponCode: appliedCoupon?.code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create instance');
      }

      setCreatedResult(data.instance);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setLoading(false);
    }
  }

  // If successfully created, show credentials modal
  if (createdResult) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className="card space-y-6 border-emerald-500/30">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-8 h-8 shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Database Instance Active!
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Your managed cluster <strong>{createdResult.name}</strong> is running and ready for connections.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-2">
            <p className="font-semibold text-amber-200">
              ⚠️ Important: Master Database Password Generated
            </p>
            <p>
              Copy this password now. For security reasons, LioranDB does not store passwords in plaintext and you will not be able to view it again.
            </p>
            {createdResult.password && (
              <div className="p-2.5 bg-black/40 rounded border border-amber-500/30 font-mono text-sm text-white select-all">
                {createdResult.password}
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs font-mono bg-[var(--surface-2)] p-4 rounded-lg border border-[var(--border)]">
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Host / Endpoint</span>
              <span className="text-[var(--text-primary)]">{createdResult.host}:{createdResult.port}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Database Name</span>
              <span className="text-[var(--text-primary)]">{createdResult.databaseName}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--text-muted)]">Master User</span>
              <span className="text-[var(--text-primary)]">{createdResult.username}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/database/${createdResult.id}`}
              className="btn btn-primary text-xs py-2 px-5"
            >
              Go to Database Control Plane →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Create Database Instance</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Self-service postpaid deployment with no upfront registration fees
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleCreateInstance} className="space-y-6">
        {/* Step 1: Instance Name */}
        <div className="card space-y-3">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            1. Instance Name *
          </label>
          <input
            type="text"
            required
            pattern="^[a-z0-9-]+$"
            title="Lowercase letters, numbers, and hyphens only"
            className="input text-xs w-full font-mono"
            placeholder="my-production-db"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
          />
          <p className="text-[11px] text-[var(--text-muted)]">
            Lowercase alphanumeric characters and hyphens only (3–32 chars).
          </p>
        </div>

        {/* Step 2: Plan Selection */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              2. Select Database Plan
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Usage accumulates hourly while your instance is active. Billed postpaid monthly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shared Plan */}
            <div
              onClick={() => setSelectedPlanId('shared')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedPlanId === 'shared'
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-[var(--text-primary)]">Shared</span>
                <span className="text-xs font-mono font-bold text-[var(--primary)]">₹1/hour</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Developers, MVPs, prototypes, small applications, and testing.
              </p>
              <div className="space-y-1 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Up to 1,000 documents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Up to 3,000 ops/sec max limit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Shared infrastructure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No backups by default</span>
                </div>
              </div>
            </div>

            {/* Dedicated Plan */}
            <div
              onClick={() => setSelectedPlanId('dedicated')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedPlanId === 'dedicated'
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-[var(--text-primary)]">Dedicated</span>
                <span className="text-xs font-mono font-bold text-[var(--primary)]">₹8/hour</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Production workloads requiring dedicated managed compute.
              </p>
              <div className="space-y-1 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dedicated managed database instance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dedicated compute throughput</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Custom production capacity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No backups by default</span>
                </div>
              </div>
            </div>
          </div>

          {/* High Capacity Notice */}
          <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-[var(--text-primary)]">High Capacity Enterprise (₹250/hour): </span>
              <span className="text-[var(--text-muted)]">
                For high-throughput and specialized workloads.
              </span>
            </div>
            <a
              href={`mailto:${SUPPORT_CONTACT_EMAIL}?subject=High%20Capacity%20Instance%20Inquiry`}
              className="btn btn-secondary text-xs inline-flex items-center gap-1 shrink-0 ml-3"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact LioranDB</span>
            </a>
          </div>
        </div>

        {/* Step 3: Managed Backups */}
        <div className="card space-y-3">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            3. Optional Managed Backups
          </label>
          <label className="flex items-start gap-3 p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={backupEnabled}
              onChange={(e) => setBackupEnabled(e.target.checked)}
            />
            <div className="space-y-0.5 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Enable Automated Managed Backups (+₹200/month)
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                Continuous point-in-time recovery and snapshot archives. Prorated to active running instance duration.
              </p>
            </div>
          </label>
        </div>

        {/* Step 4: Optional Coupon */}
        <div className="card space-y-3">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            4. Promotional Coupon (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input uppercase font-mono text-xs flex-1"
              placeholder="e.g. LAUNCH20"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="btn btn-secondary text-xs px-4"
            >
              {couponLoading ? 'Checking...' : 'Apply Coupon'}
            </button>
          </div>

          {appliedCoupon && (
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
              ✓ Coupon <strong>{appliedCoupon.code}</strong> applied: {appliedCoupon.discountPercentage}% discount on accumulated charges.
            </div>
          )}
          {couponError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              {couponError}
            </div>
          )}
        </div>

        {/* Step 5: Review & Create */}
        <div className="card space-y-4">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            5. Order Review
          </label>

          <div className="space-y-2 text-xs bg-[var(--surface-2)] p-4 rounded-lg border border-[var(--border)]">
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Instance Name</span>
              <span className="font-mono text-[var(--text-primary)]">{instanceName || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Plan & Hourly Rate</span>
              <span className="font-medium text-[var(--text-primary)]">
                {selectedPlan.name} ({formatPaiseToRupees(selectedPlan.hourlyRatePaise)}/hr)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Managed Backups</span>
              <span className="text-[var(--text-primary)]">
                {backupEnabled ? 'Enabled (+₹200/month prorated)' : 'Disabled (₹0)'}
              </span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between py-1 border-b border-[var(--border)] text-emerald-400">
                <span>Promotional Discount</span>
                <span>-{appliedCoupon.discountPercentage}%</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-sm font-semibold text-[var(--text-primary)] pt-2">
              <span>Upfront Payment Due Now</span>
              <span className="text-emerald-400">₹0.00 (Postpaid)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !instanceName.trim()}
            className="btn btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Provisioning Database Instance...</span>
              </>
            ) : (
              <>
                <span>Create Database Instance</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
