'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';

// This root-segment boundary also catches database failures in nested layouts.
// Next.js 16.3's retry() refetches server content as well as resetting the boundary.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const isRetrying = isPending || isReconnecting;

  async function handleRetry() {
    if (isRetrying) return;

    setIsReconnecting(true);
    try {
      await fetch('/api/system/database/reconnect', {
        method: 'POST',
        cache: 'no-store',
      });
    } catch {
      // retry() below still gives Next.js another chance to connect.
    } finally {
      setIsReconnecting(false);
      startTransition(() => retry());
    }
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section aria-labelledby="service-unavailable-heading" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6 text-center shadow-2xs">
        <h1 id="service-unavailable-heading" className="text-xl font-semibold text-[var(--text-primary)]">
          Temporarily unavailable
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          We couldn&apos;t connect to LioranDB. We&apos;ll reconnect and try loading this page again.
        </p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={handleRetry}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isReconnecting ? 'Reconnecting...' : isPending ? 'Trying again...' : 'Try again'}
        </button>
        <p role="status" className="sr-only">{isRetrying ? 'Reconnecting to LioranDB and retrying this page.' : ''}</p>
      </section>
    </main>
  );
}
