'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Ban, FileText } from 'lucide-react';

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalFormatted: string;
}

export default function AdminInvoiceActions({ invoiceId, invoiceNumber, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMarkPaid() {
    const reference = prompt(`Enter payment transaction reference/UTR for ${invoiceNumber}:`, 'MANUAL_SETTLEMENT');
    if (!reference) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionReference: reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark invoice as paid');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid() {
    const reason = prompt(`Enter reason for voiding invoice ${invoiceNumber}:`, 'Billing correction');
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void invoice');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {status !== 'PAID' && status !== 'VOID' && (
        <>
          <button
            onClick={handleMarkPaid}
            disabled={loading}
            title="Mark as Paid"
            className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark Paid</span>
          </button>
          <button
            onClick={handleVoid}
            disabled={loading}
            title="Void Invoice"
            className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Void</span>
          </button>
        </>
      )}
      <a
        href={`/api/invoices/${invoiceId}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View JSON Snapshot"
        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
