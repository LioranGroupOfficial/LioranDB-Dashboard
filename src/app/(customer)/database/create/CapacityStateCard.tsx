'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw, Server, AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Props {
  status: 'ALL_ASSIGNED' | 'RECOVERING' | 'QUARANTINED' | 'GATEWAY_UNAVAILABLE' | 'CAPACITY_AVAILABLE';
  headline: string;
  description: string;
  contactEmail: string;
}

export default function CapacityStateCard({
  status,
  headline,
  description,
  contactEmail,
}: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (status !== 'RECOVERING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/hosting/capacity');
        const data = await res.json();
        if (data.availableCount > 0) {
          router.refresh();
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [status, router]);

  async function handleManualCheck() {
    setChecking(true);
    try {
      const res = await fetch('/api/hosting/capacity');
      const data = await res.json();
      if (data.availableCount > 0) {
        router.refresh();
      }
    } catch {} finally {
      setChecking(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6 px-3 sm:px-0">
      <div className="card p-5 sm:p-8 space-y-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-[8px] bg-[var(--surface-soft)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
            {status === 'RECOVERING' ? (
              <RotateCw className="w-5 h-5 text-[var(--text-strong)] animate-spin" />
            ) : status === 'QUARANTINED' ? (
              <AlertCircle className="w-5 h-5 text-[var(--text-strong)]" />
            ) : (
              <Server className="w-5 h-5 text-[var(--text-strong)]" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[var(--text-strong)]">{headline}</h1>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
          </div>
        </div>

        {status === 'RECOVERING' && (
          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
            <div className="flex items-center gap-2 text-[var(--text-strong)] font-semibold">
              <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>Automatic Recovery in Progress</span>
            </div>
            <p className="text-[var(--text-muted)]">
              An unassigned hosting node container is currently starting up and verifying its database engine. This page will automatically update once the node is ready.
            </p>
          </div>
        )}

        {status === 'ALL_ASSIGNED' && (
          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
            <p className="font-semibold text-[var(--text-strong)]">Request a Dedicated Server:</p>
            <p>
              Please mail <strong className="text-[var(--text-strong)] font-mono break-all">{contactEmail}</strong> to provision and bring a new dedicated hosting server online for your account.
            </p>
          </div>
        )}

        {status === 'QUARANTINED' && (
          <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
            <p className="font-semibold text-[var(--text-strong)]">Security & Cleanliness Quarantine:</p>
            <p className="text-[var(--text-muted)]">
              Nodes are quarantined until physical storage reset is verified by site reliability engineering. Please contact <strong className="text-[var(--text-strong)] font-mono break-all">{contactEmail}</strong> if you require expedited capacity.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[var(--border)]">
          <Link
            href="/dashboard"
            className="btn-secondary text-xs py-2.5 sm:py-2 px-3.5 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Back to Dashboard</span>
          </Link>

          {status === 'RECOVERING' ? (
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={checking}
              className="btn-primary text-xs py-2.5 sm:py-2 px-4 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking...' : 'Check Availability'}</span>
            </button>
          ) : (
            <a
              href={`mailto:${contactEmail}?subject=Dedicated%20Database%20Server%20Allocation%20Request`}
              className="btn-primary text-xs py-2.5 sm:py-2 px-4 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-center"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Mail {contactEmail}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
