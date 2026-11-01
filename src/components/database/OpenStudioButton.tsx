'use client';

import { ExternalLink } from 'lucide-react';
import { studioUnavailableReason, type DatabaseConnection } from '@/lib/database-connection';

export default function OpenStudioButton({ db, className = '' }: { db: DatabaseConnection; className?: string }) {
  const unavailableReason = studioUnavailableReason(db);

  async function openStudio() {
    if (studioUnavailableReason(db) || !db.id) return;

    // Reserve the popup synchronously so browsers do not block the later redirect.
    // The URL contains only a short-lived, single-use handoff token; credentials
    // are redeemed by Studio over HTTPS and never enter browser history or URLs.
    const studioWindow = window.open('about:blank', '_blank');
    if (!studioWindow) return;
    studioWindow.opener = null;

    try {
      const response = await fetch(`/api/instances/${encodeURIComponent(db.id)}/studio-handoff`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to open Studio.');
      studioWindow.location.replace(data.url);
    } catch {
      studioWindow.close();
      window.alert('Studio could not be opened for this database. Please try again.');
    }
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
