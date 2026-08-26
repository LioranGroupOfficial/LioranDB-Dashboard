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
    <div className="card space-y-4">
      <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
        Connection Details
      </h2>

      {db.passwordChangeRequired && (
        <div className="alert-banner alert-banner-warning">
          <div>
            <strong className="text-sm">Temporary credentials — change required</strong>
            <p className="text-sm mt-1">
              These are temporary credentials. You must change your database password immediately upon first connection.
              {credExpiry && !isExpired && (
                <> Credentials expire: {credExpiry.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</>
              )}
              {isExpired && <strong className="text-red-400"> Credentials have expired — contact support.</strong>}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <CredRow label="Database name" value={db.databaseName} onCopy={() => copyToClipboard(db.databaseName, 'databaseName')} copied={copied === 'databaseName'} />
        <CredRow label="Host" value={db.host} onCopy={() => copyToClipboard(db.host, 'host')} copied={copied === 'host'} />
        <CredRow label="Port" value={String(db.port)} onCopy={() => copyToClipboard(String(db.port), 'port')} copied={copied === 'port'} />
        <CredRow label="Username" value={db.username} onCopy={() => copyToClipboard(db.username, 'username')} copied={copied === 'username'} />
      </div>

      {db.connectionUri && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label">Connection URI</span>
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div
            className="rounded-md p-3 font-mono text-xs break-all"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            {revealed ? (
              <span className="text-[var(--text-primary)]">{db.connectionUri}</span>
            ) : (
              <span className="text-[var(--text-muted)]">{'•'.repeat(60)}</span>
            )}
          </div>
          {revealed && (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => copyToClipboard(db.connectionUri!, 'uri')}
                className="text-xs btn-secondary px-2 py-1"
              >
                {copied === 'uri' ? '✓ Copied' : 'Copy URI'}
              </button>
              <p className="text-xs text-red-400">
                Keep this URI secure. Never share it publicly or include it in URLs.
              </p>
            </div>
          )}
        </div>
      )}

      {db.provisionedAt && (
        <p className="text-xs text-[var(--text-muted)]">
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[var(--text-muted)] w-32 shrink-0">{label}</span>
      <span className="text-sm text-[var(--text-primary)] font-mono flex-1 truncate">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}
