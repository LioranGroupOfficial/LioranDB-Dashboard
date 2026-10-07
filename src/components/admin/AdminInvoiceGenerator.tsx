'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, Loader2 } from 'lucide-react';

export default function AdminInvoiceGenerator() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    if (!confirm('Run monthly invoice generation for all active customers for the previous billing cycle?')) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/billing/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoices');
      setResult(`Success: Generated ${data.invoicesGenerated || 0} invoice(s).`);
      router.refresh();
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-[var(--primary)] font-mono">{result}</span>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn btn-primary text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <PlayCircle className="w-3.5 h-3.5" />
        )}
        <span>{loading ? 'Generating...' : 'Generate Monthly Invoices'}</span>
      </button>
    </div>
  );
}
