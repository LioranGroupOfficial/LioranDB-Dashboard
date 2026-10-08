import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, Invoice, IInvoice } from '@/lib/db';
import AdminBillingClient, { AdminInvoiceItem } from './AdminBillingClient';

export const metadata = { title: 'Billing & Invoices — Admin' };

export default async function AdminBillingPage() {
  await requireAdmin();
  await connectToDatabase();

  const invoices = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean<IInvoice[]>();

  const formatted: AdminInvoiceItem[] = invoices.map((inv) => ({
    _id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId?.toString() || '',
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    billingPeriod: {
      start: inv.billingPeriod?.start ? new Date(inv.billingPeriod.start).toISOString() : new Date().toISOString(),
      end: inv.billingPeriod?.end ? new Date(inv.billingPeriod.end).toISOString() : new Date().toISOString(),
    },
    issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
    subtotalPaise: inv.subtotalPaise || 0,
    discountPaise: inv.discountPaise || 0,
    taxPaise: inv.taxPaise || 0,
    totalPaise: inv.totalPaise || 0,
    status: inv.status,
    paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
    paymentTransactionReference: inv.paymentTransactionReference || null,
    lineItemsCount: (inv.lineItems || []).length,
    createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
  }));

  return <AdminBillingClient initialInvoices={formatted} />;
}
