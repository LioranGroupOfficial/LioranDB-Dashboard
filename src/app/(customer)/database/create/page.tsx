'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Database,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Server,
  Cpu,
  Loader2,
  AlertCircle,
  CreditCard,
  Plus,
  Sparkles,
} from 'lucide-react';
import { PLANS, calculatePlanPrice, formatRupees } from '@/lib/plans';
import AddCreditsModal from '@/components/wallet/AddCreditsModal';

export default function CreateInstancePage() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('ap-south-1 (Mumbai)');
  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [backupAddon, setBackupAddon] = useState(false);

  // Wallet balance state
  const [walletBalancePaise, setWalletBalancePaise] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Status & processing
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [provisioningStatus, setProvisioningStatus] = useState<
    'idle' | 'provisioning' | 'completed'
  >('idle');
  const [provisionedInstanceId, setProvisionedInstanceId] = useState<string | null>(null);

  const planList = Object.values(PLANS);
  const currentPlan = PLANS[selectedPlanId] || PLANS.starter;
  const priceBreakdown = calculatePlanPrice(selectedPlanId, backupAddon);

  const fetchWallet = async () => {
    try {
      setLoadingWallet(true);
      const res = await fetch('/api/wallet');
      const data = await res.json();
      if (res.ok) {
        setWalletBalancePaise(data.balancePaise);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter an instance name with at least 2 characters.');
      return;
    }
    setErrorMessage('');
    setStep(2);
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = PLANS[planId];
    if (plan.backupIncluded) {
      setBackupAddon(false);
    }
  };

  const availableBalancePaise = walletBalancePaise ?? 0;
  const hasSufficientCredits = availableBalancePaise >= priceBreakdown.totalPricePaise;
  const remainingPaise = availableBalancePaise - priceBreakdown.totalPricePaise;
  const shortfallPaise = Math.max(0, priceBreakdown.totalPricePaise - availableBalancePaise);

  const handleCreateWithCredits = async () => {
    try {
      if (!hasSufficientCredits) {
        setErrorMessage('Insufficient credit balance. Please add credits before continuing.');
        return;
      }

      setLoading(true);
      setErrorMessage('');
      setProvisioningStatus('provisioning');
      setStep(5);

      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          planId: selectedPlanId,
          backupAddon: currentPlan.backupIncluded ? false : backupAddon,
          region,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create instance.');
      }

      setProvisionedInstanceId(data.instanceId);
      setWalletBalancePaise(data.remainingBalancePaise);
      setProvisioningStatus('completed');
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Instance creation failed.';
      setErrorMessage(errStr);
      setLoading(false);
      setProvisioningStatus('idle');
      setStep(4);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-tertiary)] mb-2">
            <Link href="/database" className="hover:text-[var(--color-text-primary)]">
              Databases
            </Link>
            <span>/</span>
            <span className="text-[var(--color-text-primary)]">Create Instance</span>
          </div>
          <h1 className="font-serif text-3xl font-normal text-[var(--color-text-primary)]">
            Deploy LioranDB Managed Instance
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Purchased and renewed directly from your prepaid account credits.
          </p>
        </div>

        {/* Live Credit Widget */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <div>
            <span className="text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] block">
              Available Credits
            </span>
            <span className="font-serif text-lg font-bold text-[var(--color-text-primary)]">
              {loadingWallet ? '...' : `₹${((walletBalancePaise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </span>
          </div>
          <AddCreditsModal
            buttonText="Add Credits"
            className="py-1 px-2.5 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors inline-flex items-center gap-1 cursor-pointer"
            onSuccess={(newBal) => setWalletBalancePaise(newBal)}
          />
        </div>
      </div>

      {/* Wizard Progress Indicator */}
      {step < 5 && (
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 text-xs font-mono">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]'}`}>
              1
            </span>
            <span>1. Name & Region</span>
          </div>
          <div className={`hidden sm:flex items-center gap-2 ${step >= 2 ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]'}`}>
              2
            </span>
            <span>2. Choose Plan</span>
          </div>
          <div className={`hidden sm:flex items-center gap-2 ${step >= 3 ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]'}`}>
              3
            </span>
            <span>3. Backups</span>
          </div>
          <div className={`flex items-center gap-2 ${step >= 4 ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 4 ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]'}`}>
              4
            </span>
            <span>4. Review & Deploy</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Name & Region */}
      {step === 1 && (
        <form onSubmit={handleNextFromStep1} className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
              Instance Details
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Choose a unique display name and target region for your LioranDB cluster.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                Instance Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. production-core-db"
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
              />
              <span className="text-[11px] text-[var(--color-text-tertiary)] mt-1 block">
                Only lowercase letters, numbers, and hyphens recommended.
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                Deployment Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
              >
                <option value="ap-south-1 (Mumbai)">ap-south-1 (Mumbai, India) — Ultra-Low Latency</option>
                <option value="ap-southeast-1 (Singapore)">ap-southeast-1 (Singapore)</option>
                <option value="eu-central-1 (Frankfurt)">eu-central-1 (Frankfurt)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="py-2.5 px-5 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Select Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: Choose Plan */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                Choose your LioranDB Plan
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Purchased in monthly increments from your credit balance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {planList.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`relative rounded-xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[var(--color-surface-raised)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 shadow-sm'
                      : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] hover:border-[var(--color-text-tertiary)]'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-mono uppercase tracking-wider font-semibold">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {plan.type}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
                      {plan.name}
                    </h3>

                    <div className="mt-3 mb-4">
                      <span className="font-serif text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
                        ₹{plan.priceRupees.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]"> /month</span>
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] mb-4 min-h-[32px]">
                      {plan.purpose}
                    </p>

                    <div className="space-y-2 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                        <span>{plan.cpu}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                        <span>{plan.memory}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                        <span>{plan.documentGuideline}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                        <span>
                          {plan.backupIncluded ? 'Daily backup included' : 'Backup optional (+₹500)'}
                        </span>
                      </div>
                    </div>

                    {plan.isSharedNotice && (
                      <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                        {plan.isSharedNotice}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
                    <button
                      type="button"
                      className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-2.5 px-4 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer border border-[var(--color-border-subtle)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="py-2.5 px-5 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Continue to Backups</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Backup Selection */}
      {step === 3 && (
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
              Automated Daily Backups
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Protect your database against accidental deletion and hardware failures.
            </p>
          </div>

          {currentPlan.backupIncluded ? (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold">
                    Daily Backups Included in {currentPlan.name}
                  </h3>
                  <p className="text-xs mt-1 opacity-90">
                    Your chosen plan already includes automated daily snapshots with 7-day retention at no extra charge.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setBackupAddon(!backupAddon)}
              className={`p-5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                backupAddon
                  ? 'bg-[var(--color-surface-sunken)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                  : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] hover:border-[var(--color-text-tertiary)]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-5 h-5 rounded mt-0.5 border flex items-center justify-center transition-colors ${
                  backupAddon ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]'
                }`}>
                  {backupAddon && <Check className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    Enable Automated Daily Backups (+₹500/month)
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Automated 24-hour backup snapshots with point-in-time recovery and one-click rollback.
                  </p>
                </div>
              </div>
              <span className="text-sm font-serif font-bold text-[var(--color-text-primary)] shrink-0">
                +₹500/mo
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-2.5 px-4 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer border border-[var(--color-border-subtle)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="py-2.5 px-5 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Review Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Deploy */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                  Order Summary
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Review your deployment specifications. Credits will be deducted upon confirmation.
                </p>
              </div>

              <div className="space-y-3 border-t border-[var(--color-border-subtle)] pt-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Instance Name</span>
                  <span className="font-mono font-medium text-[var(--color-text-primary)]">{name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Region</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{region}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Plan</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{currentPlan.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Resources</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {currentPlan.cpu} • {currentPlan.memory}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Document Limit</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {currentPlan.documentGuideline}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--color-text-secondary)]">Backups</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {priceBreakdown.backupAddon ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Payment Box */}
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-6 flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
                Credit Balance Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[var(--color-text-secondary)]">
                  <span>Available Balance</span>
                  <span className="font-mono font-medium text-[var(--color-text-primary)]">
                    ₹{(availableBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between text-[var(--color-text-secondary)]">
                  <span>Required Credits</span>
                  <span className="font-mono font-medium text-[var(--color-primary)]">
                    -₹{(priceBreakdown.totalPricePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border-t border-[var(--color-border-subtle)] pt-3 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {hasSufficientCredits ? 'Remaining Balance' : 'Shortfall Amount'}
                  </span>
                  <span className={`font-serif text-xl font-bold ${hasSufficientCredits ? 'text-[var(--color-text-primary)]' : 'text-red-500'}`}>
                    ₹{(Math.abs(remainingPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {!hasSufficientCredits && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Insufficient Credits</span>
                  </div>
                  <p className="text-[11px]">
                    You need an additional ₹{(shortfallPaise / 100).toLocaleString('en-IN')} credits to deploy this instance.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {hasSufficientCredits ? (
                <button
                  type="button"
                  onClick={handleCreateWithCredits}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Instance — ₹{priceBreakdown.totalPriceRupees.toLocaleString('en-IN')} Credits</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <AddCreditsModal
                  buttonText={`Add Credits (Need ₹${(shortfallPaise / 100).toLocaleString('en-IN')})`}
                  initialAmount={Math.max(100, Math.ceil(shortfallPaise / 100))}
                  className="w-full py-3 px-4 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  onSuccess={(newBal) => {
                    setWalletBalancePaise(newBal);
                    setErrorMessage('');
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={loading}
                className="w-full py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-center cursor-pointer"
              >
                Modify Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Provisioning Status Screen */}
      {step === 5 && (
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] mx-auto flex items-center justify-center border border-[var(--color-primary)]/20">
            {provisioningStatus === 'provisioning' ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            )}
          </div>

          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[var(--color-text-primary)]">
              {provisioningStatus === 'provisioning'
                ? 'Provisioning your LioranDB instance...'
                : 'Instance Successfully Deployed!'}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">
              {provisioningStatus === 'provisioning'
                ? 'Deducting credits, allocating compute, setting up secure firewall credentials, and initializing MongoDB instance...'
                : 'Your managed database cluster is now active, isolated, and ready for connections.'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-xs text-left font-mono space-y-1.5 max-w-sm mx-auto">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">Status:</span>
              <span className={provisioningStatus === 'provisioning' ? 'text-amber-500' : 'text-emerald-500'}>
                {provisioningStatus === 'provisioning' ? 'PROVISIONING' : 'ACTIVE / RUNNING'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">Cluster:</span>
              <span className="text-[var(--color-text-primary)]">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">Plan:</span>
              <span className="text-[var(--color-text-primary)]">{currentPlan.name}</span>
            </div>
          </div>

          {provisioningStatus === 'completed' && (
            <div className="pt-4">
              <button
                type="button"
                onClick={() => router.push(provisionedInstanceId ? `/database/${provisionedInstanceId}` : '/database')}
                className="py-3 px-6 rounded-lg bg-[var(--color-primary)] hover:opacity-95 text-white font-medium text-sm transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <span>View Database Instance</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
