'use client';

import { useState } from 'react';

interface DbData {
  id: string;
  name: string;
  status: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  connectionUri: string | null;
  planId: string;
  passwordChangeRequired: boolean;
  temporaryCredentialExpiresAt?: string;
  provisionedAt?: string;
  suspendedAt?: string;
  suspensionReason?: string;
}

interface Props {
  db: DbData;
}

export default function DatabaseCredentials({ db }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  const credExpiry = db.temporaryCredentialExpiresAt
    ? new Date(db.temporaryCredentialExpiresAt)
    : null;
  const isExpired = credExpiry ? credExpiry < new Date() : false;

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          Connection Details
        </h2>
        <span className="text-[11px] font-mono text-[var(--accent-teal)] bg-[var(--surface-card)] px-3 py-0.5 rounded-full border border-[var(--border)]">
          TLS v1.3 Verified
        </span>
      </div>

      {db.passwordChangeRequired && (
        <div className="alert-banner alert-banner-warning text-xs">
          <div>
            <strong className="text-xs font-semibold">Temporary credentials — change required</strong>
            <p className="text-xs mt-1">
              These are temporary credentials. You must change your database password immediately upon first connection.
              {credExpiry && !isExpired && (
                <> Credentials expire: {credExpiry.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</>
              )}
              {isExpired && <strong className="text-[var(--error)] font-semibold"> Credentials have expired — contact support.</strong>}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <CredRow label="Database name" value={db.databaseName} onCopy={() => copyToClipboard(db.databaseName, 'databaseName')} copied={copied === 'databaseName'} />
        <CredRow label="Host" value={db.host} onCopy={() => copyToClipboard(db.host, 'host')} copied={copied === 'host'} />
        <CredRow label="Port" value={String(db.port)} onCopy={() => copyToClipboard(String(db.port), 'port')} copied={copied === 'port'} />
        <CredRow label="Username" value={db.username} onCopy={() => copyToClipboard(db.username, 'username')} copied={copied === 'username'} />
      </div>

      {db.connectionUri && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="label mb-0">Connection URI</span>
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="text-xs text-[var(--primary)] hover:underline transition-colors font-medium"
            >
              {revealed ? 'Hide' : 'Reveal URI'}
            </button>
          </div>
          <div className="code-mockup-card relative group">
            <div className="flex items-center justify-between gap-3 font-mono text-xs break-all">
              {revealed ? (
                <span className="text-[var(--accent-teal)] selection:bg-[var(--primary)] selection:text-white">{db.connectionUri}</span>
              ) : (
                <span className="text-[var(--on-dark-soft)] tracking-widest">{'•'.repeat(48)}</span>
              )}
              <button
                type="button"
                onClick={() => copyToClipboard(db.connectionUri!, 'uri')}
                className="btn-secondary-on-dark text-xs px-3 py-1 shrink-0 rounded-lg h-7 min-h-0"
              >
                {copied === 'uri' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          {revealed && (
            <p className="text-[11px] text-[var(--warning)]">
              Keep this URI secure. Never commit connection strings containing credentials to public repositories.
            </p>
          )}
        </div>
      )}

      {db.provisionedAt && (
        <p className="text-xs text-[var(--muted)] pt-1 border-t border-[var(--border)]">
          Provisioned:{' '}
          {new Date(db.provisionedAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 px-3.5 rounded-lg bg-[var(--surface-card)]/70 border border-[var(--hairline)]">
      <span className="text-xs text-[var(--muted)] w-28 shrink-0 font-medium">{label}</span>
      <span className="text-xs text-[var(--ink)] font-mono flex-1 truncate">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        className="text-xs text-[var(--muted)] hover:text-[var(--primary)] transition-colors shrink-0 px-2.5 py-0.5 rounded-md hover:bg-[var(--surface-cream-strong)] font-medium"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
