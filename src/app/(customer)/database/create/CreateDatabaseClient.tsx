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
  const [copied, setCopied] = useState(false);
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

  function handleCopyPassword(pwd: string) {
    navigator.clipboard.writeText(pwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // If successfully created, show credentials modal
  if (createdResult) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="card space-y-6 border-[var(--border-strong)]">
          <div className="flex items-center gap-3 text-[var(--text-strong)]">
            <CheckCircle2 className="w-7 h-7 shrink-0 text-[var(--text-strong)]" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text-strong)]">
                Database Instance Active
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Your managed cluster <strong className="text-[var(--text-strong)] font-mono">{createdResult.name}</strong> is running and ready for client connections.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
            <p className="font-bold text-[var(--text-strong)]">
              Master Database Password Generated
            </p>
            <p>
              Copy this password now. For security reasons, LioranDB hashes database credentials and you will not be able to view it in plaintext again.
            </p>
            {createdResult.password && (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--surface)] rounded-[5px] border border-[var(--border)] font-mono text-sm text-[var(--text-strong)] font-bold">
                <span className="select-all break-all">{createdResult.password}</span>
                <button
                  type="button"
                  onClick={() => handleCopyPassword(createdResult.password!)}
                  className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs font-mono bg-[var(--surface-soft)] p-4 rounded-[7px] border border-[var(--border)]">
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Host / Endpoint</span>
              <span className="text-[var(--text-strong)] font-bold">{createdResult.host}:{createdResult.port}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Database Name</span>
              <span className="text-[var(--text-strong)]">{createdResult.databaseName}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--text-muted)]">Master User</span>
              <span className="text-[var(--text-strong)]">{createdResult.username}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/database/${createdResult.id}`}
              className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5"
            >
              <span>Open Database Control Plane</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
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
        <div className="card space-y-3">
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            1. Instance Name *
          </label>
          <input
            type="text"
            required
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shared Plan - Self Service */}
            <div
              onClick={() => setSelectedPlanId('shared')}
              className={`p-4 rounded-[7px] border-2 cursor-pointer transition-all ${
                selectedPlanId === 'shared'
                  ? 'border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--text-strong)]">Shared</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border)]">
                    SELF-SERVICE
                  </span>
                </div>
                <div className="text-right">
                  {appliedCoupon ? (
                    <div>
                      <span className="text-xs line-through text-[var(--text-muted)] mr-1.5 font-mono">
                        {formatPaiseToRupees(selectedPlan.hourlyRatePaise)}/hr
                      </span>
                      <span className="text-xs font-mono font-bold text-[var(--text-strong)]">
                        {formatPaiseToRupees(
                          Math.round(selectedPlan.hourlyRatePaise * (1 - appliedCoupon.discountPercentage / 100))
                        )}/hour
                      </span>
                      <span className="block text-[10px] font-mono text-[var(--text-muted)]">
                        ({appliedCoupon.discountPercentage}% off applied)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono font-bold text-[var(--text-strong)]">₹1/hour</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Developers, MVPs, prototypes, small applications, and testing.
              </p>
              <div className="space-y-1 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[var(--text-strong)] shrink-0" />
                  <span>Up to 1,000 documents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[var(--text-strong)] shrink-0" />
                  <span>Up to 3,000 ops/sec max limit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[var(--text-strong)] shrink-0" />
                  <span>Shared cloud infrastructure</span>
                </div>
              </div>
            </div>

            {/* Dedicated Plan - Contact via email */}
            <div
              className="p-4 rounded-[7px] border-2 border-dashed border-[var(--border)] bg-[var(--surface-soft)] opacity-80 cursor-not-allowed select-none relative"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--text-strong)]">Dedicated</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
                    ON-DEMAND
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--text-muted)]">₹8/hour</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Production workloads requiring dedicated managed compute.
              </p>
              <div className="p-3 rounded-[5px] bg-[var(--surface)] border border-[var(--border)] mb-3 text-xs space-y-2">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Dedicated instances are provisioned on demand. Please contact our team via email for dedicated deployment.
                </p>
                <a
                  href={`mailto:${SUPPORT_CONTACT_EMAIL}?subject=Dedicated%20Instance%20Provisioning%20Inquiry`}
                  className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1.5 font-semibold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact: {SUPPORT_CONTACT_EMAIL}</span>
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
            disabled={loading || !instanceName.trim()}
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
