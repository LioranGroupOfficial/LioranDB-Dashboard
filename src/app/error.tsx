'use client';

import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';

// This root-segment boundary also catches database failures in nested layouts.
// Next.js 16.3's retry() refetches server content as well as resetting the boundary.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section aria-labelledby="service-unavailable-heading" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6 text-center shadow-2xs">
        <h1 id="service-unavailable-heading" className="text-xl font-semibold text-[var(--text-primary)]">
          Temporarily unavailable
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          We couldn&apos;t load this page. The database service may be unavailable. Please try again in a moment.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => retry())}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Trying again...' : 'Try again'}
        </button>
        <p role="status" className="sr-only">{isPending ? 'Retrying this page.' : ''}</p>
      </section>
    </main>
  );
}
