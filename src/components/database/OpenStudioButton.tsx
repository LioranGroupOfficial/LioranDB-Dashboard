'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { studioHandoffUnavailableReason, type DatabaseConnection } from '@/lib/database-connection';

export default function OpenStudioButton({ db, className = '' }: { db: DatabaseConnection; className?: string }) {
  const unavailableReason = studioHandoffUnavailableReason(db);
  const [opening, setOpening] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function openStudio() {
    if (unavailableReason || !db.id || opening) return;
    setOpening(true);
    setLaunchError(null);
    const studioWindow = window.open('about:blank', '_blank');

    try {
      const response = await fetch(`/api/instances/${encodeURIComponent(db.id)}/studio-handoff`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null;
      if (!response.ok || typeof data?.url !== 'string') {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Studio handoff failed.');
      }
      if (!studioWindow) throw new Error('Please allow pop-ups to open Studio.');
      studioWindow.opener = null;
      studioWindow.location.replace(data.url);
    } catch (error) {
      studioWindow?.close();
      setLaunchError(error instanceof Error ? error.message : 'Studio handoff failed.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openStudio()}
      disabled={!!unavailableReason || !db.id || opening}
      title={launchError || unavailableReason || 'Open this allocation in Studio (opens a new tab)'}
      aria-label={unavailableReason ? `Open Studio: ${unavailableReason}` : 'Open Studio (opens a new tab)'}
      className={`${className} shrink-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
    >
      <span>{opening ? 'Opening Studio…' : 'Open Studio'}</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
