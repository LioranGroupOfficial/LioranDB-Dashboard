'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Code2, Eye, EyeOff, Terminal } from 'lucide-react';
import { maskConnectionUri } from '@/lib/database-connection';
import CopyButton from './CopyButton';

type Language = 'javascript' | 'typescript';
const languages = ['javascript', 'typescript'] as const;
const installCommand = 'npm install @liorandb/driver';

// Verified against @liorandb/driver 2.0.8's declarations and implementation.
// Keep a reference before connecting so finally can close a failed connection too.
function connectionExample(language: Language, databaseName: string): string {
  const typescript = language === 'typescript';
  return `import { LioranDBClient } from "@liorandb/driver";

const uri${typescript ? ': string | undefined' : ''} = process.env.LIORANDB_URI;

let client${typescript ? ': LioranDBClient | undefined' : ''};

try {
  if (!uri) throw new Error("LIORANDB_URI is missing");

  client = new LioranDBClient(uri, {
    transport: "grpc",
  });
  await client.connect();

  const db = client.db(${JSON.stringify(databaseName)});

  console.log("Connected to LioranDB");
  console.log("Database instance ready:", !!db);
} catch {
  // Keep credentials and driver error details out of logs.
  console.error("Connection failed. Check configuration and availability.");
  process.exitCode = 1;
} finally {
  if (client) {
    try {
      await client.close();
    } catch {
      console.error("Failed to close the LioranDB connection.");
      process.exitCode = 1;
    }
  }
}`;
}

/** Quote an exact URI for .env without changing its bytes through escape expansion. */
function environmentExample(uri: string): string | null {
  const expandsEscapes = /\\[nr]/.test(uri);
  const quote = !uri.includes('"') && !expandsEscapes ? '"'
    : !uri.includes("'") ? "'"
      : !uri.includes('`') && !expandsEscapes ? '`' : null;
  return quote ? `LIORANDB_URI=${quote}${uri}${quote}` : null;
}

// Small tokenizer for these fixed snippets. React escapes all text, including strings.
function HighlightedCode({ code }: { code: string }) {
  const tokens = code.split(/("(?:[^"\\]|\\.)*"|\/\/[^\n]*|\b(?:import|from|const|let|try|if|throw|new|await|catch|finally|undefined|string|LioranDBClient|Error)\b|\b\d+\b)/g);
  return tokens.map((token, index) => {
    const className = token.startsWith('//') ? 'text-[var(--muted)] italic'
      : token.startsWith('"') ? 'text-emerald-700 dark:text-emerald-300'
        : /^(?:string|undefined|LioranDBClient|Error)$/.test(token) ? 'text-sky-700 dark:text-sky-300'
          : /^(?:import|from|const|let|try|if|throw|new|await|catch|finally)$/.test(token) ? 'text-violet-700 dark:text-violet-300'
            : /^\d+$/.test(token) ? 'text-amber-700 dark:text-amber-300' : undefined;
    return <span key={index} className={className}>{token}</span>;
  });
}

export default function QuickConnect({ connectionUri, databaseName, unavailableReason }: {
  connectionUri: string | null;
  databaseName: string;
  unavailableReason: string | null;
}) {
  const [language, setLanguage] = useState<Language>('javascript');
  const [showCredentials, setShowCredentials] = useState(false);
  const id = useId();
  const examples = {
    javascript: connectionExample('javascript', databaseName),
    typescript: connectionExample('typescript', databaseName),
  };
  const code = examples[language];
  // Reserve the taller example's natural height without creating a nested Y scroller.
  const codeHeight = Math.max(...Object.values(examples).map((example) => example.split('\n').length)) * 1.25 + 2;
  const env = connectionUri ? environmentExample(connectionUri) : null;
  const visibleEnv = connectionUri
    ? showCredentials ? env : `LIORANDB_URI="${maskConnectionUri(connectionUri)}"`
    : 'LIORANDB_URI="REPLACE_WITH_YOUR_CONNECTION_URI"';
  const runCommand = language === 'javascript'
    ? 'node --env-file=.env connect.mjs'
    : 'node --env-file=.env connect.ts';

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    const index = languages.indexOf(language);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? 1
      : event.key === 'ArrowRight' ? (index + 1) % 2
        : event.key === 'ArrowLeft' ? (index + 1) % 2 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = languages[nextIndex];
    setLanguage(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-language="${next}"]`)?.focus();
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 shadow-2xs sm:p-6">
      <div>
        <h2 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
          <Code2 aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          Quick Connect
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Connect your application to LioranDB using our official JavaScript and TypeScript driver.
        </p>
        <p className="mt-2 break-all text-xs text-[var(--muted)]">Database: <span className="font-mono text-[var(--text-primary)]">{databaseName}</span></p>
      </div>

      {unavailableReason && <p className="text-xs text-[var(--text-secondary)]">{unavailableReason} You can still copy the starter code.</p>}

      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
          <Terminal aria-hidden="true" className="h-3.5 w-3.5" /> Installation
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <code className="break-all font-mono text-xs text-[var(--text-primary)]">{installCommand}</code>
          <CopyButton value={installCommand} ariaLabel="Copy installation command" />
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] p-2">
          <div role="tablist" aria-label="Quick Connect language" className="flex gap-1">
            {languages.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                id={`${id}-${option}-tab`}
                aria-controls={`${id}-${option}-panel`}
                aria-selected={language === option}
                tabIndex={language === option ? 0 : -1}
                data-language={option}
                onClick={() => setLanguage(option)}
                onKeyDown={navigateTabs}
                className={`min-h-8 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:px-3 ${language === option ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--muted)] hover:text-[var(--text-primary)]'}`}
              >
                {option === 'javascript' ? 'JavaScript (.mjs)' : 'TypeScript (.ts)'}
              </button>
            ))}
          </div>
          <CopyButton value={code} label="Copy code" ariaLabel={`Copy ${language === 'javascript' ? 'JavaScript' : 'TypeScript'} connection code`} />
        </div>
        {languages.map((option) => (
          <div
            key={option}
            role="tabpanel"
            id={`${id}-${option}-panel`}
            aria-labelledby={`${id}-${option}-tab`}
            hidden={language !== option}
            tabIndex={0}
            className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <pre style={{ minHeight: `${codeHeight}rem` }} className="overflow-x-auto p-4 font-mono text-xs leading-5 text-[var(--text-primary)]"><code><HighlightedCode code={examples[option]} /></code></pre>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">Environment variable · .env</h3>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={!env}
              aria-pressed={showCredentials}
              aria-controls={`${id}-env`}
              onClick={() => setShowCredentials(!showCredentials)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showCredentials ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
              {showCredentials ? 'Hide credentials' : 'Reveal credentials'}
            </button>
            <CopyButton value={env} label="Copy .env" ariaLabel="Copy environment variable with actual credentials" />
          </div>
        </div>
        <pre id={`${id}-env`} className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3.5 font-mono text-xs leading-5 text-[var(--text-primary)]"><code>{visibleEnv || 'This URI cannot be safely quoted in a .env file. Set LIORANDB_URI directly in your environment.'}</code></pre>
        <p className="text-[11px] text-[var(--muted)]">
          {env ? 'Copy .env includes the actual credentials, even while hidden. ' : 'The environment variable cannot be copied until a complete, safely quoted URI is available. '}
          Keep .env private and add it to .gitignore. Code reads LIORANDB_URI and contains no credentials.
        </p>
      </div>

      <div className="space-y-2 text-xs text-[var(--text-secondary)]">
        <p>Save the example as <code className="font-mono">connect.{language === 'javascript' ? 'mjs' : 'ts'}</code> beside .env, then run with Node.js 22.18+:</p>
        <code className="block overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 font-mono text-xs text-[var(--text-primary)]">{runCommand}</code>
        <p className="text-[11px] text-[var(--muted)]">For TypeScript, set <code className="font-mono">{'"type": "module"'}</code> in package.json. Uses gRPC for data and closes the client after this connection check, including after a failed connection.</p>
      </div>
    </section>
  );
}
