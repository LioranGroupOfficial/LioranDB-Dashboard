import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, Invoice, User, IInvoice } from '@/lib/db';
import { getAllCustomersLiveUsage } from '@/lib/billing';
import AdminBillingClient, { AdminInvoiceItem, CustomerOption } from './AdminBillingClient';

export const metadata = { title: 'Billing & Invoices — Admin' };

export default async function AdminBillingPage() {
  await requireAdmin();
  await connectToDatabase();

  const [invoices, liveUsage, customers] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).limit(200).lean<IInvoice[]>(),
    getAllCustomersLiveUsage(),
    User.find({ role: 'customer' }).select('_id email profile').sort({ email: 1 }).lean(),
  ]);

  const formattedInvoices: AdminInvoiceItem[] = invoices.map((inv) => ({
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
    lineItems: (inv.lineItems || []).map((li) => ({
      instanceName: li.instanceName,
      planName: li.planName,
      hourlyRatePaise: li.hourlyRatePaise,
      billableHours: li.billableHours,
      usageAmountPaise: li.usageAmountPaise,
      backupAmountPaise: li.backupAmountPaise,
      discountPaise: li.discountPaise,
      subtotalPaise: li.subtotalPaise,
      description: li.description,
    })),
    createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
  }));

  const formattedCustomers: CustomerOption[] = customers.map((c) => ({
    _id: c._id.toString(),
    email: c.email,
    name: c.profile?.fullName || c.email.split('@')[0],
  }));

  return (
    <AdminBillingClient
      initialInvoices={formattedInvoices}
      initialLiveUsage={liveUsage}
      customers={formattedCustomers}
    />
  );
}
