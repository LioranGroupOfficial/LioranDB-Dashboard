'use client';

import { ExternalLink } from 'lucide-react';
import { getFullConnectionUri, studioUnavailableReason, type DatabaseConnection } from '@/lib/database-connection';

export default function OpenStudioButton({ db, className = '' }: { db: DatabaseConnection; className?: string }) {
  const unavailableReason = studioUnavailableReason(db);

  function openStudio() {
    const connectionUri = getFullConnectionUri(db.connectionUri);
    if (studioUnavailableReason(db) || !connectionUri) return;

    // Encode the exact stored URI once. Never render or log this credential-bearing URL.
    // Replace with a single-use handoff token when Studio supports token redemption.
    window.open(
      `https://studio.liorandb.com/?connection=${encodeURIComponent(connectionUri)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <button
      type="button"
      onClick={openStudio}
      disabled={!!unavailableReason}
      title={unavailableReason || 'Open this database in Studio (opens a new tab)'}
      aria-label={unavailableReason ? `Open Studio: ${unavailableReason}` : 'Open this database in Studio (opens a new tab)'}
      className={`${className} shrink-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
    >
      <span>Open Studio</span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
