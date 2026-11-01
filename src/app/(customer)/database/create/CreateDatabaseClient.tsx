'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  CheckCircle2,
  Database,
  ArrowLeft,
  Copy,
  Sparkles,
} from 'lucide-react';
import { PLANS, SUPPORT_CONTACT_EMAIL, formatPaiseToRupees } from '@/lib/plans';

interface Props {
  activeDatabasesCount: number;
  maxLimit: number;
}

export default function CreateDatabaseClient({ activeDatabasesCount, maxLimit }: Props) {
  const router = useRouter();

  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<'free' | 'shared' | 'dedicated'>('free');
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
  const [freeTier, setFreeTier] = useState<{ loading: boolean; enabled: boolean; availableSlots: number | null; hasAllocation: boolean }>({ loading: true, enabled: false, availableSlots: null, hasAllocation: false });

  useEffect(() => {
    let active = true;
    fetch('/api/customer/free-tier')
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setFreeTier({ loading: false, enabled: Boolean(data.enabled), availableSlots: typeof data.availableSlots === 'number' ? data.availableSlots : null, hasAllocation: Boolean(data.hasAllocation) });
      })
      .catch(() => active && setFreeTier((current) => ({ ...current, loading: false })));
    return () => { active = false; };
  }, []);

  const selectedPlan = PLANS[selectedPlanId];
  const canSelectFree = !freeTier.loading && freeTier.enabled && !freeTier.hasAllocation && (freeTier.availableSlots ?? 0) > 0;

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

  // Create instance and directly redirect to database details
  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    const requiresManualName = selectedPlanId !== 'free';
    if (requiresManualName && !instanceName.trim()) {
      setErrorMessage('Please enter an instance name');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const payload: Record<string, unknown> = {
        planId: selectedPlanId,
        backupEnabled,
        couponCode: appliedCoupon?.code,
      };
      if (requiresManualName) payload.name = instanceName.trim();

      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create instance');
      }

      // Directly redirect user to the created database details page
      const targetId = data.instance?.id || data.instance?._id;
      if (targetId) {
        router.push(`/database/${targetId}`);
        router.refresh();
      } else {
        router.push('/database');
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Creation failed');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Create Database Instance</h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Self-service postpaid deployment billed hourly (Limit: {activeDatabasesCount}/{maxLimit} databases used)
          </p>
        </div>

        <Link
          href="/database"
          className="btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Databases</span>
        </Link>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)] text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleCreateInstance} className="space-y-6">
        {/* Step 1: Instance Name */}
        {selectedPlanId === 'free' ? (
          <div className="card space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              1. Instance Name
            </label>
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-soft)] p-3 font-mono text-xs text-[var(--text-strong)]">
              Generated automatically after you create the database
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Free Shared instances receive a unique name such as <span className="font-mono">free-a7k2m9c3</span>.
            </p>
          </div>
        ) : null}
        <div className={`${selectedPlanId === 'free' ? 'hidden' : ''} card space-y-3`}>
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            1. Instance Name *
          </label>
          <input
            type="text"
            required={selectedPlanId !== 'free'}
            pattern="^[a-z0-9-]+$"
            title="Lowercase letters, numbers, and hyphens only"
            className="input-field text-xs w-full font-mono"
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
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              2. Select Database Plan
            </label>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Usage accumulates hourly while your instance is active. Billed postpaid monthly.
            </p>
          </div>

          <div className="@container/plan-grid grid grid-cols-1 gap-4 @lg/plan-grid:grid-cols-2 @2xl/plan-grid:grid-cols-3">
            {/* Free shared plan — provisioned by the Rust shared-hosting control plane */}
            <div
              onClick={() => { if (canSelectFree) { setSelectedPlanId('free'); setBackupEnabled(false); } }}
              onKeyDown={(event) => { if (canSelectFree && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedPlanId('free'); setBackupEnabled(false); } }}
              role="button"
              tabIndex={canSelectFree ? 0 : -1}
              aria-disabled={!canSelectFree}
              aria-pressed={selectedPlanId === 'free'}
              className={`flex h-full min-w-0 flex-col rounded-[7px] border-2 p-4 transition-all sm:p-5 ${selectedPlanId === 'free' ? 'border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-xs' : 'border-[var(--border)] bg-[var(--surface)]'} ${freeTier.loading || freeTier.hasAllocation || freeTier.availableSlots === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[var(--border-strong)]'}`}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 text-sm font-bold text-[var(--text-strong)]">Free Shared</span>
                  <span className="badge badge-default whitespace-nowrap px-1.5 py-0.5 text-[10px]">FREE</span>
                </div>
                <div className="mt-3 flex items-baseline justify-end gap-3 text-right">
                  <span className="text-xs font-mono font-bold text-[var(--text-strong)]">₹0</span>
                </div>
              </div>
              <p className="mt-3 min-w-0 text-xs leading-5 text-[var(--text-secondary)]">One isolated tenant allocation in the shared free-tier pool. Create multiple logical databases in Studio.</p>
              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--text-muted)]">
                <div className="flex min-w-0 items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" /><span className="min-w-0">512 MiB storage quota</span></div>
                <div className="flex min-w-0 items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" /><span className="min-w-0">Shared pool: 2 vCPU / 512 MiB</span></div>
                <div className="flex min-w-0 items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" /><span className="min-w-0">{freeTier.loading ? 'Checking capacity…' : freeTier.hasAllocation ? 'Already allocated to this account' : freeTier.availableSlots === null ? 'Capacity unavailable' : `${freeTier.availableSlots} of 10 slots available`}</span></div>
              </div>
            </div>
            {/* Shared Plan - Self Service */}
            <div
              onClick={() => setSelectedPlanId('shared')}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedPlanId('shared'); } }}
              role="button"
              tabIndex={0}
              aria-pressed={selectedPlanId === 'shared'}
              className={`flex h-full min-w-0 flex-col rounded-[7px] border-2 p-4 cursor-pointer transition-all sm:p-5 ${
                selectedPlanId === 'shared'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 text-sm font-bold text-[var(--text-strong)]">Shared</span>
                  <span className="badge badge-default whitespace-nowrap px-1.5 py-0.5 text-[10px]">SELF-SERVICE</span>
                </div>
                <div className="mt-3 flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-right">
                  {appliedCoupon ? (
                    <div className="min-w-0">
                      <span className="mr-1.5 text-xs font-mono text-[var(--text-muted)] line-through">
                        {formatPaiseToRupees(PLANS.shared.hourlyRatePaise)}/hr
                      </span>
                      <span className="text-xs font-mono font-bold text-[var(--text-strong)]">
                        {formatPaiseToRupees(
                          Math.round(PLANS.shared.hourlyRatePaise * (1 - appliedCoupon.discountPercentage / 100))
                        )}/hour
                      </span>
                      <span className="block text-[10px] font-mono text-[var(--text-muted)]">
                        ({appliedCoupon.discountPercentage}% off applied)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono font-bold text-[var(--text-strong)]">
                      {formatPaiseToRupees(PLANS.shared.hourlyRatePaise)}/hour
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
                Developers, MVPs, prototypes, small applications, and testing.
              </p>
              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--text-muted)]">
                <div className="flex min-w-0 items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" />
                  <span className="min-w-0">Up to 1,000 documents</span>
                </div>
                <div className="flex min-w-0 items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" />
                  <span className="min-w-0">Up to 3,000 ops/sec max limit</span>
                </div>
                <div className="flex min-w-0 items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-strong)]" />
                  <span className="min-w-0">Shared cloud infrastructure</span>
                </div>
              </div>
            </div>

            {/* Dedicated Plan - Contact via email */}
            <div
              className="flex h-full min-w-0 flex-col rounded-[7px] border-2 border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 opacity-80 cursor-not-allowed select-none sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 text-sm font-bold text-[var(--text-strong)]">Dedicated</span>
                  <span className="badge badge-default whitespace-nowrap px-1.5 py-0.5 text-[10px]">ON-DEMAND</span>
                </div>
                <div className="mt-3 flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-right">
                  {appliedCoupon ? (
                    <div className="min-w-0">
                      <span className="mr-1.5 text-xs font-mono text-[var(--text-muted)] line-through">
                        {formatPaiseToRupees(PLANS.dedicated.hourlyRatePaise)}/hr
                      </span>
                      <span className="text-xs font-mono font-bold text-[var(--text-strong)]">
                        {formatPaiseToRupees(
                          Math.round(PLANS.dedicated.hourlyRatePaise * (1 - appliedCoupon.discountPercentage / 100))
                        )}/hour
                      </span>
                      <span className="block text-[10px] font-mono text-[var(--text-muted)]">
                        ({appliedCoupon.discountPercentage}% off applied)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                      {formatPaiseToRupees(PLANS.dedicated.hourlyRatePaise)}/hour
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
                Production workloads requiring dedicated managed compute.
              </p>
              <div className="mt-4 flex min-w-0 flex-1 flex-col gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
                <p className="min-w-0 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Dedicated instances are provisioned on demand. Please contact our team via email for dedicated deployment.
                </p>
                <a
                  href={`mailto:${SUPPORT_CONTACT_EMAIL}?subject=Dedicated%20Instance%20Provisioning%20Inquiry`}
                  className="btn-secondary mt-auto min-w-0 w-full justify-start px-2.5 py-1 text-left text-xs font-semibold leading-4 whitespace-normal break-words"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">Contact: {SUPPORT_CONTACT_EMAIL}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Promotional Coupon */}
        <div className="card space-y-3">
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            3. Promotional Coupon (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field uppercase font-mono text-xs flex-1"
              placeholder="e.g. LAUNCH20"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="btn-secondary text-xs px-4"
            >
              {couponLoading ? 'Checking...' : 'Apply Coupon'}
            </button>
          </div>

          {appliedCoupon && (
            <div className="p-2.5 rounded-[5px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] font-mono flex items-center justify-between">
              <div>
                ✓ Coupon <strong>{appliedCoupon.code}</strong> applied: {appliedCoupon.discountPercentage}% discount on hourly rate.
              </div>
              <span className="font-bold text-[var(--text-strong)] ml-2">
                New Rate: {formatPaiseToRupees(
                  Math.round(selectedPlan.hourlyRatePaise * (1 - appliedCoupon.discountPercentage / 100))
                )}/hr
              </span>
            </div>
          )}
          {couponError && (
            <div className="p-2.5 rounded-[5px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)]">
              {couponError}
            </div>
          )}
        </div>

        {/* Step 4: Review & Create */}
        <div className="card space-y-4">
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            4. Deployment Review
          </label>

          <div className="space-y-2 text-xs bg-[var(--surface-soft)] p-4 rounded-[7px] border border-[var(--border)] font-mono">
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Instance Name</span>
              <span className="font-bold text-[var(--text-strong)]">{instanceName || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Plan</span>
              <span className="font-medium text-[var(--text-strong)]">
                {selectedPlan.name}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Base Hourly Rate</span>
              <span className={appliedCoupon ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-strong)]'}>
                {formatPaiseToRupees(selectedPlan.hourlyRatePaise)}/hr
              </span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between py-1 border-b border-[var(--border)] font-bold text-[var(--text-strong)]">
                <span>Effective Rate ({appliedCoupon.code} -{appliedCoupon.discountPercentage}%)</span>
                <span>
                  {formatPaiseToRupees(
                    Math.round(selectedPlan.hourlyRatePaise * (1 - appliedCoupon.discountPercentage / 100))
                  )}/hr
                </span>
              </div>
            )}
            <div className="flex justify-between py-1 text-sm font-semibold text-[var(--text-strong)] pt-2 border-t border-[var(--border)]">
              <span>Upfront Payment Due Now</span>
              <span className="text-[var(--text-strong)] font-bold">₹0.00 (Postpaid)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (selectedPlanId !== 'free' && !instanceName.trim())}
            className="btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-2"
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
