'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';

// This root-segment boundary also catches database failures in nested layouts.
// Next.js 16.3's retry() refetches server content as well as resetting the boundary.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const autoRetryAttempted = useRef(false);
  const isRetrying = isPending || isReconnecting;

  const reconnectAndRetry = useCallback(async () => {
    if (isRetrying) return;

    setIsReconnecting(true);
    setReconnectFailed(false);
    try {
      const response = await fetch('/api/system/database/reconnect', {
        method: 'POST',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('LioranDB reconnect failed');
      }

      startTransition(() => retry());
    } catch {
      setReconnectFailed(true);
    } finally {
      setIsReconnecting(false);
    }
  }, [isRetrying, retry, startTransition]);

  // Give the database one fresh connection attempt before presenting the
  // unavailable state to the user. The ref prevents a changing retry
  // callback from causing repeated automatic attempts.
  useEffect(() => {
    if (autoRetryAttempted.current) return;
    autoRetryAttempted.current = true;
    void reconnectAndRetry();
  }, [reconnectAndRetry]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section aria-labelledby="service-unavailable-heading" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6 text-center shadow-2xs">
        <h1 id="service-unavailable-heading" className="text-xl font-semibold text-[var(--text-primary)]">
          {reconnectFailed ? 'Temporarily unavailable' : 'Reconnecting to LioranDB'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {reconnectFailed
            ? 'We couldn\'t connect to LioranDB. Please try again in a moment.'
            : 'We\'re reconnecting to LioranDB before loading this page.'}
        </p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={() => void reconnectAndRetry()}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isReconnecting ? 'Reconnecting...' : isPending ? 'Loading again...' : 'Reconnect and try again'}
        </button>
        <p role="status" className="sr-only">{isRetrying ? 'Reconnecting to LioranDB and retrying this page.' : ''}</p>
      </section>
    </main>
  );
}
