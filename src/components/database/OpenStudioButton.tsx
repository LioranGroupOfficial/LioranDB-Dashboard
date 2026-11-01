'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getRootConnectionUri, studioUnavailableReason, type DatabaseConnection } from '@/lib/database-connection';

export default function OpenStudioButton({ db, className = '' }: { db: DatabaseConnection; className?: string }) {
  const unavailableReason = studioUnavailableReason(db);
  const [opening, setOpening] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function openStudio() {
    const connectionUri = getRootConnectionUri(db.connectionUri, db.port, db.host, db.databaseName);
    if (unavailableReason || !connectionUri || opening) return;
    setOpening(true);
    setLaunchError(null);

    try {
      window.open(
        `https://studio.liorandb.com/?connection=${encodeURIComponent(connectionUri)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Studio handoff failed.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openStudio()}
      disabled={!!unavailableReason || !db.connectionUri || opening}
      title={launchError || unavailableReason || 'Open this allocation in Studio (opens a new tab)'}
      aria-label={unavailableReason ? `Open Studio: ${unavailableReason}` : 'Open Studio (opens a new tab)'}
      className={`${className} shrink-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
    >
      <span>{opening ? 'Opening Studio…' : 'Open Studio'}</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
