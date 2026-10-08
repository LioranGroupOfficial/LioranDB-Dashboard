'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Loader2,
  X,
  Receipt,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
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
  const [verifyingInvoiceId, setVerifyingInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

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
      setSuccessMessage('');

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
        const paidDate = new Date();
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: 'PAID', paidAt: paidDate } : inv))
        );
        if (selectedInvoice?.id === invoice.id) {
          setSelectedInvoice((prev) => (prev ? { ...prev, status: 'PAID', paidAt: paidDate } : null));
        }
        setSuccessMessage(`Invoice ${invoice.invoiceNumber} marked as PAID.`);
        router.refresh();
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
        modal: {
          ondismiss: function () {
            setPayingId(null);
          },
        },
        handler: async function (response: RazorpayResponse) {
          try {
            // Show verifying loading state immediately upon checkout completion
            setVerifyingInvoiceId(invoice.id);
            setError('');

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

            const paidDate = new Date();
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === invoice.id
                  ? {
                      ...inv,
                      status: 'PAID',
                      paidAt: paidDate,
                      paymentId: response.razorpay_payment_id,
                    }
                  : inv
              )
            );

            if (selectedInvoice?.id === invoice.id) {
              setSelectedInvoice((prev) =>
                prev
                  ? {
                      ...prev,
                      status: 'PAID',
                      paidAt: paidDate,
                      paymentId: response.razorpay_payment_id,
                    }
                  : null
              );
            }

            setSuccessMessage(`Payment confirmed! Invoice ${invoice.invoiceNumber} is now marked as PAID.`);
            router.refresh();
          } catch (verifyErr: unknown) {
            setError(verifyErr instanceof Error ? verifyErr.message : 'Verification failed');
          } finally {
            setVerifyingInvoiceId(null);
            setPayingId(null);
          }
        },
        prefill: {
          name: invoice.customerName,
          email: invoice.customerEmail,
        },
        theme: {
          color: '#18181b',
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Verifying Payment Banner */}
      {verifyingInvoiceId && (
        <div className="p-4 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] flex items-center gap-3 animate-in fade-in duration-150">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[var(--text-strong)]" />
          <div>
            <span className="font-bold block">Verifying Payment with Gateway...</span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Cryptographically verifying payment signature and updating invoice status. Please wait.
            </span>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-mono">
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
                const isCurrentPaying = payingId === inv.id;
                const isCurrentVerifying = verifyingInvoiceId === inv.id;

                return (
                  <tr key={inv.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-strong)]">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="hover:underline cursor-pointer"
                      >
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
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
                    <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">
                      {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      {isCurrentVerifying ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-mono uppercase tracking-wider bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Updating...</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-mono uppercase tracking-wider ${
                            isPaid
                              ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-semibold'
                              : isOverdue
                              ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold'
                              : 'bg-[var(--surface-soft)] text-[var(--text-primary)] border border-[var(--border)]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-xs text-[var(--text-strong)]">
                      {formatPaiseToRupees(inv.totalPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
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
                            disabled={isCurrentPaying || isCurrentVerifying}
                            className="btn-primary py-1 px-2.5 min-h-[30px] text-[11px] inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {isCurrentPaying || isCurrentVerifying ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            <span>{isCurrentVerifying ? 'Verifying...' : 'Pay'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs font-sans text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-6 h-6 opacity-40" />
                      <span>No invoices generated yet. Invoices are generated at the end of each billing month.</span>
                    </div>
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
          <div className="relative card border-[var(--border)] max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Loading Overlay When Verifying Payment */}
            {verifyingInvoiceId === selectedInvoice.id && (
              <div className="absolute inset-0 z-30 bg-[var(--surface)]/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 rounded-[8px] animate-in fade-in duration-150">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--text-strong)]" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--text-strong)]">Verifying Payment</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono max-w-xs">
                    Confirming payment signature with Razorpay and updating invoice status to PAID...
                  </p>
                </div>
              </div>
            )}

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                  Authoritative Invoice Snapshot
                </span>
                <h3 className="font-mono text-2xl font-bold text-[var(--text-strong)]">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Issued: {new Date(selectedInvoice.issueDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-mono uppercase tracking-wider ${
                    selectedInvoice.status === 'PAID'
                      ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-semibold'
                      : selectedInvoice.status === 'OVERDUE'
                      ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold'
                      : 'bg-[var(--surface-soft)] text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer & Period Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[var(--surface-soft)] p-4 rounded-[7px] border border-[var(--border)]">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Billed To</span>
                <span className="font-bold text-[var(--text-strong)]">{selectedInvoice.customerName}</span>
                <span className="text-[var(--text-secondary)] block font-mono">{selectedInvoice.customerEmail}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Billing Period</span>
                <span className="text-[var(--text-strong)]">
                  {new Date(selectedInvoice.billingPeriod.start).toLocaleDateString('en-IN')} –{' '}
                  {new Date(selectedInvoice.billingPeriod.end).toLocaleDateString('en-IN')}
                </span>
                <span className="text-[var(--text-muted)] block">
                  Due: <span className="font-semibold text-[var(--text-strong)]">{new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')}</span>
                </span>
              </div>
            </div>

            {/* Line Items Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Billable Usage Line Items
              </h4>
              <div className="border border-[var(--border)] rounded-[7px] overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 px-3 font-medium">Instance / Service</th>
                      <th className="py-2 px-3 font-medium text-right">Hours</th>
                      <th className="py-2 px-3 font-medium text-right">Rate</th>
                      <th className="py-2 px-3 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(selectedInvoice.lineItems || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-soft)]">
                        <td className="py-2.5 px-3">
                          <strong className="text-[var(--text-strong)] block font-sans">{item.instanceName}</strong>
                          <span className="text-[10px] text-[var(--text-muted)] font-sans">{item.description || item.planName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          {item.billableHours.toFixed(1)} hrs
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          {formatPaiseToRupees(item.hourlyRatePaise)}/hr
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[var(--text-strong)]">
                          {formatPaiseToRupees(item.subtotalPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Calculation Breakdown */}
            <div className="border-t border-[var(--border)] pt-4 space-y-1.5 text-xs font-mono max-w-xs ml-auto">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal:</span>
                <span>{formatPaiseToRupees(selectedInvoice.subtotalPaise)}</span>
              </div>
              {selectedInvoice.discountPaise > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Coupon Discount:</span>
                  <span>-{formatPaiseToRupees(selectedInvoice.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Taxes &amp; GST (0%):</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[var(--text-strong)] border-t border-[var(--border)] pt-2 font-mono">
                <span>Total Amount:</span>
                <span>{formatPaiseToRupees(selectedInvoice.totalPaise)}</span>
              </div>
            </div>

            {/* Paid Settlement Details */}
            {selectedInvoice.status === 'PAID' && (
              <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--text-strong)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--text-strong)]" />
                  <span>Settlement Confirmed</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  <div>
                    <span className="text-[var(--text-muted)]">Paid At:</span>{' '}
                    {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString('en-IN') : 'Confirmed'}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Payment Reference:</span>{' '}
                    <span className="font-bold text-[var(--text-strong)]">{selectedInvoice.paymentId || 'GATEWAY-CONFIRMED'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Close
                </button>
                {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'VOID' && (
                  <button
                    type="button"
                    onClick={() => handlePayInvoice(selectedInvoice)}
                    disabled={payingId === selectedInvoice.id || verifyingInvoiceId === selectedInvoice.id}
                    className="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {payingId === selectedInvoice.id || verifyingInvoiceId === selectedInvoice.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    <span>
                      {verifyingInvoiceId === selectedInvoice.id
                        ? 'Verifying Payment...'
                        : `Pay Invoice (${formatPaiseToRupees(selectedInvoice.totalPaise)})`}
                    </span>
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
