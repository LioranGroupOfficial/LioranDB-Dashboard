'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  billingPeriod: {
    start: string | Date;
    end: string | Date;
  };
  issueDate: string | Date;
  dueDate: string | Date;
  lineItems: Array<{
    instanceName: string;
    planName: string;
    hourlyRatePaise: number;
    billableHours: number;
    usageAmountPaise: number;
    backupAmountPaise: number;
    discountPaise: number;
    subtotalPaise: number;
    description?: string;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';
  paidAt?: string | Date;
  paymentId?: string;
}

interface Props {
  initialInvoices: InvoiceItem[];
}

export default function InvoicesList({ initialInvoices }: Props) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window.Razorpay !== 'undefined') {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayInvoice = async (invoice: InvoiceItem) => {
    try {
      setPayingId(invoice.id);
      setError('');

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load Razorpay payment gateway SDK.');
      }

      // 1. Create order
      const res = await fetch(`/api/invoices/${invoice.id}/checkout`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate payment.');
      }

      if (data.alreadyPaid) {
        // Invoice was 0 amount and marked paid
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: 'PAID' } : inv))
        );
        if (selectedInvoice?.id === invoice.id) {
          setSelectedInvoice((prev) => (prev ? { ...prev, status: 'PAID' } : null));
        }
        return;
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: data.keyId,
        amount: data.amountPaise,
        currency: data.currency || 'INR',
        name: 'LioranDB Cloud',
        description: `Invoice ${invoice.invoiceNumber} Payment`,
        order_id: data.orderId,
        handler: async function (response: RazorpayResponse) {
          try {
            const verifyRes = await fetch(`/api/invoices/${invoice.id}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment signature verification failed.');
            }

            setInvoices((prev) =>
              prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: 'PAID', paidAt: new Date() } : inv))
            );
            if (selectedInvoice?.id === invoice.id) {
              setSelectedInvoice((prev) => (prev ? { ...prev, status: 'PAID', paidAt: new Date() } : null));
            }
            router.refresh();
          } catch (verifyErr: unknown) {
            setError(verifyErr instanceof Error ? verifyErr.message : 'Verification failed');
          }
        },
        prefill: {
          name: invoice.customerName,
          email: invoice.customerEmail,
        },
        theme: {
          color: '#00ed64',
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface-card)] shadow-2xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--muted)] uppercase font-mono">
              <tr>
                <th className="py-3 px-4 font-medium">Invoice Number</th>
                <th className="py-3 px-4 font-medium">Billing Period</th>
                <th className="py-3 px-4 font-medium">Issue Date</th>
                <th className="py-3 px-4 font-medium">Due Date</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {invoices.map((inv) => {
                const isPaid = inv.status === 'PAID';
                const isOverdue = inv.status === 'OVERDUE';
                return (
                  <tr key={inv.id} className="hover:bg-[var(--surface-2)]/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="hover:underline text-[var(--primary)] cursor-pointer"
                      >
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">
                      {new Date(inv.billingPeriod.start).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      –{' '}
                      {new Date(inv.billingPeriod.end).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-[var(--muted)]">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-[var(--muted)]">
                      {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          isPaid
                            ? 'badge-active'
                            : isOverdue
                            ? 'badge-suspended'
                            : 'badge-default'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-serif font-bold text-sm text-[var(--text-primary)]">
                      {formatPaiseToRupees(inv.totalPaise)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="btn-secondary py-1 px-2.5 min-h-[30px] text-[11px]"
                        >
                          View
                        </button>
                        {!isPaid && inv.status !== 'VOID' && (
                          <button
                            type="button"
                            onClick={() => handlePayInvoice(inv)}
                            disabled={payingId === inv.id}
                            className="btn-primary py-1 px-2.5 min-h-[30px] text-[11px] inline-flex items-center gap-1"
                          >
                            {payingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            <span>Pay</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs font-sans text-[var(--muted)]">
                    No invoices generated yet. Invoices are automatically generated at the end of each billing month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICE DETAILS MODAL (Immutable Snapshot) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase block">
                  Authoritative Invoice Snapshot
                </span>
                <h3 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Issued: {new Date(selectedInvoice.issueDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`badge text-xs ${
                    selectedInvoice.status === 'PAID'
                      ? 'badge-active'
                      : 'badge-default'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer & Period Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[var(--surface-2)] p-4 rounded-lg border border-[var(--border)]">
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">Billed To</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedInvoice.customerName}</span>
                <span className="text-[var(--text-secondary)] block">{selectedInvoice.customerEmail}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">Billing Period</span>
                <span className="text-[var(--text-primary)]">
                  {new Date(selectedInvoice.billingPeriod.start).toLocaleDateString('en-IN')} –{' '}
                  {new Date(selectedInvoice.billingPeriod.end).toLocaleDateString('en-IN')}
                </span>
                <span className="text-[var(--muted)] block">
                  Due: {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>

            {/* Line Items Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">
                Billable Usage Line Items
              </h4>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--muted)]">
                    <tr>
                      <th className="py-2 px-3 font-medium">Instance / Service</th>
                      <th className="py-2 px-3 font-medium text-right">Hours</th>
                      <th className="py-2 px-3 font-medium text-right">Rate</th>
                      <th className="py-2 px-3 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(selectedInvoice.lineItems || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3">
                          <strong className="text-[var(--text-primary)] block font-sans">{item.instanceName}</strong>
                          <span className="text-[10px] text-[var(--muted)]">{item.description || item.planName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          {item.billableHours.toFixed(1)} hrs
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          ₹{item.hourlyRatePaise / 100}/hr
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[var(--text-primary)]">
                          ₹{(item.subtotalPaise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Calculation Breakdown */}
            <div className="border-t border-[var(--border)] pt-4 space-y-2 text-xs font-mono max-w-xs ml-auto">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal:</span>
                <span>₹{(selectedInvoice.subtotalPaise / 100).toFixed(2)}</span>
              </div>
              {selectedInvoice.discountPaise > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount:</span>
                  <span>-₹{(selectedInvoice.discountPaise / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Taxes:</span>
                <span>₹{(selectedInvoice.taxPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-serif font-bold text-[var(--text-primary)] border-t border-[var(--border)] pt-2">
                <span>Total Amount:</span>
                <span>{formatPaiseToRupees(selectedInvoice.totalPaise)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted)] font-mono">
                {selectedInvoice.paidAt
                  ? `Paid on ${new Date(selectedInvoice.paidAt).toLocaleString('en-IN')}`
                  : `Payment Due by ${new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')}`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="py-2 px-4 rounded-lg bg-[var(--surface-2)] text-xs text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
                >
                  Close
                </button>
                {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'VOID' && (
                  <button
                    type="button"
                    onClick={() => handlePayInvoice(selectedInvoice)}
                    disabled={payingId === selectedInvoice.id}
                    className="py-2 px-5 rounded-lg bg-[var(--primary)] hover:opacity-95 text-white text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {payingId === selectedInvoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Pay Invoice ({formatPaiseToRupees(selectedInvoice.totalPaise)})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
