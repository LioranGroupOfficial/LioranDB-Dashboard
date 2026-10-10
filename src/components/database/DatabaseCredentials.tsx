'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, ShieldCheck, Eye, EyeOff } from 'lucide-react';

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
  billingStartedAt?: string;
  provisionedAt?: string;
}

interface Props {
  db: DbData;
}

export default function DatabaseCredentials({ db }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showUri, setShowUri] = useState(false);

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  const realConnectionUri = (
    db.connectionUri ||
    `liorandb+https://${encodeURIComponent(db.username)}:<password>@${db.host}:${db.port}`
  ).replace(/^(liorandb(?:\+https)?:\/\/[^/?]+).*$/, "$1");
  // const realConnectionUri =
  //   db.connectionUri ||
  //   `liorandb://${encodeURIComponent(db.username)}:<password>@${db.host}:${db.port}/${encodeURIComponent(db.databaseName)}`;

  // Mask the password portion by default
  const maskedConnectionUri = realConnectionUri.replace(
    /:(?:[^@/:]+)@/,
    ':••••••••••••••••@'
  );

  const displayedUri = showUri ? realConnectionUri : maskedConnectionUri;

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
            Connection Details
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Use these connection parameters to connect your backend application or MongoDB driver.
          </p>
        </div>
        <a
          href="https://studio.liorandb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="py-1.5 px-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-card)] text-xs font-medium text-[var(--text-primary)] border border-[var(--border)] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
        >
          <span>Open Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="space-y-2.5">
        <CredRow
          label="Hostname"
          value={db.host}
          onCopy={() => copyToClipboard(db.host, 'host')}
          copied={copied === 'host'}
        />
        <CredRow
          label="Port"
          value={String(db.port)}
          onCopy={() => copyToClipboard(String(db.port), 'port')}
          copied={copied === 'port'}
        />
        <CredRow
          label="Database Name"
          value={db.databaseName}
          onCopy={() => copyToClipboard(db.databaseName, 'databaseName')}
          copied={copied === 'databaseName'}
        />
        <CredRow
          label="Default User"
          value={db.username}
          onCopy={() => copyToClipboard(db.username, 'username')}
          copied={copied === 'username'}
        />
      </div>

      {/* Connection URI Box */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">
            Connection String URI
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUri(!showUri)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              {showUri ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide URL</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show URL</span>
                </>
              )}
            </button>

            <span className="text-[var(--border)]">•</span>

            <button
              type="button"
              onClick={() => copyToClipboard(realConnectionUri, 'uri')}
              className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              {copied === 'uri' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied URI</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URI</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] break-all select-all flex items-center justify-between gap-3">
          <span className="flex-1">{displayedUri}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowUri(!showUri)}
              className="p-1.5 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors cursor-pointer"
              title={showUri ? 'Hide password in URI' : 'Show full password in URI'}
            >
              {showUri ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(realConnectionUri, 'uri')}
              className="p-1.5 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors cursor-pointer"
              title="Copy URI with real password"
            >
              {copied === 'uri' ? <Check className="w-3.5 h-3.5 text-[var(--text-primary)]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--muted)]">
          {showUri
            ? 'Connection string includes your live authenticated database password.'
            : 'Password hidden for security. Click "Show URL" or copy directly to use with your LioranDB or MongoDB client.'}
        </p>
      </div>
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
    <div className="flex items-center justify-between gap-4 py-2 px-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
      <span className="text-xs text-[var(--muted)] w-32 shrink-0 font-medium">{label}</span>
      <span className="text-xs text-[var(--text-primary)] font-mono flex-1 truncate">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        className="text-xs text-[var(--muted)] hover:text-[var(--primary)] transition-colors shrink-0 px-2 py-0.5 rounded hover:bg-[var(--surface-card)] font-mono cursor-pointer"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
