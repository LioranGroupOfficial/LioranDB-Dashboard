'use client';

import { useId, useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getFullConnectionUri, maskConnectionUri, studioUnavailableReason, type DatabaseConnection } from '@/lib/database-connection';
import CopyButton from './CopyButton';
import OpenStudioButton from './OpenStudioButton';
import QuickConnect from './QuickConnect';

interface DbData extends DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
}

export default function DatabaseCredentials({ db }: { db: DbData }) {
  const [showUri, setShowUri] = useState(false);
  const uriId = useId();
  const connectionUri = getFullConnectionUri(db.connectionUri);
  const unavailableReason = studioUnavailableReason(db);
  const displayedUri = connectionUri
    ? showUri ? connectionUri : maskConnectionUri(connectionUri)
    : 'Connection URI unavailable';

  return (
    <>
      <section aria-label="Connection Details" className="min-w-0 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 shadow-2xs sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              Connection Details
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Connect your backend application with the official LioranDB driver.
            </p>
          </div>
          <OpenStudioButton
            db={db}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-2xs transition-colors hover:bg-[var(--surface-card)]"
          />
        </div>

        {unavailableReason && <p role="status" className="text-xs text-[var(--text-secondary)]">{unavailableReason}</p>}

        <div className="space-y-2.5">
          <CredRow label="Hostname" value={db.host} />
          <CredRow label="Port" value={db.port ? String(db.port) : ''} />
          <CredRow label="Database Name" value={db.databaseName} />
          <CredRow label="Default User" value={db.username} />
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">Connection String URI</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!connectionUri}
                onClick={() => setShowUri(!showUri)}
                aria-pressed={showUri}
                aria-controls={uriId}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showUri ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
                {showUri ? 'Hide password' : 'Show password'}
              </button>
              <CopyButton value={connectionUri} label="Copy URI" ariaLabel="Copy full connection URI with password" />
            </div>
          </div>
          <div id={uriId} className="break-all rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3.5 font-mono text-xs text-[var(--text-primary)] select-all">
            {displayedUri}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            {!connectionUri
              ? 'The complete URI or password is unavailable. No placeholder connection will be used.'
              : showUri
                ? 'This connection string contains your live database password. Keep it private.'
                : 'Password and URI options hidden. Copy URI includes the complete connection string.'}
          </p>
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          Open Studio sends credentials in its URL. Browser history and Studio access logs or monitoring may retain them.
        </p>
      </section>
      <QuickConnect key={db.id} connectionUri={connectionUri} databaseName={db.databaseName} unavailableReason={unavailableReason} />
    </>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:gap-x-4">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <span className="col-start-1 row-start-2 break-all font-mono text-xs text-[var(--text-primary)] sm:col-start-auto sm:row-start-auto">{value || 'Unavailable'}</span>
      <span className="col-start-2 row-span-2 row-start-1 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        <CopyButton value={value || null} ariaLabel={`Copy ${label.toLowerCase()}`} />
      </span>
    </div>
  );
}
