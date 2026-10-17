'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ value, label = 'Copy', ariaLabel }: {
  value: string | null;
  label?: string;
  ariaLabel: string;
}) {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    if (!value) return;
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');
    } catch {
      setFeedback('failed');
    }
    timer.current = setTimeout(() => setFeedback(null), 2500);
  }

  return (
    <span className="inline-flex shrink-0">
      <button
        type="button"
        disabled={!value}
        onClick={copy}
        aria-label={ariaLabel}
        title={feedback === 'failed' ? 'Clipboard access failed. Check browser clipboard permissions.' : ariaLabel}
        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {feedback === 'copied' ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
        {feedback === 'copied' ? 'Copied' : feedback === 'failed' ? 'Copy failed' : label}
      </button>
      <span role="status" className="sr-only">
        {feedback === 'copied' ? `${ariaLabel}: copied to clipboard.` : feedback === 'failed' ? 'Copy failed. Check browser clipboard permissions.' : ''}
      </span>
    </span>
  );
}
