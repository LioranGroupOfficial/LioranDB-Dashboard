import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Invoice, SupportTicket, Payment, IManagedDatabase, IUser } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  Users,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

export const metadata = { title: 'Customer Details — Admin' };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  await connectToDatabase();
  const [customer, instances, invoices, tickets, payments] = await Promise.all([
    User.findById(id).select('-passwordHash').lean<IUser>(),
    ManagedDatabase.find({ $or: [{ customerId: id }, { userId: id }] })
      .sort({ createdAt: -1 })
      .lean<IManagedDatabase[]>(),
    Invoice.find({ customerId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
    Payment.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  if (!customer) notFound();

  const isFeePaid = Boolean(customer.accountVerification?.feePaid || customer.accountRegistrationPaid);
  const verStatus = customer.accountVerification?.status || (isFeePaid ? 'VERIFIED' : 'UNPAID');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link href="/admin/customers" className="hover:text-[var(--text-strong)] inline-flex items-center gap-1.5 transition-colors font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Customers</span>
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">
            {customer.profile?.fullName || customer.email}
          </h1>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">{customer.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              customer.emailVerified
                ? 'badge-active'
                : 'badge-default'
            }`}
          >
            {customer.emailVerified ? 'Email Verified' : 'Unverified Email'}
          </span>
          <span
            className={`badge ${
              isFeePaid
                ? 'badge-active'
                : 'badge-default'
            }`}
          >
            {isFeePaid ? '₹30 Verified' : 'Unpaid Verification'}
          </span>
        </div>
      </div>

      {/* Account Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile Info */}
        <div className="card p-5 space-y-2 text-xs">
          <h2 className="font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2 font-mono">
            <Users className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Profile</span>
          </h2>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Company:</span>
            <span className="text-[var(--text-primary)] font-medium">{customer.profile?.company || '—'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Country:</span>
            <span className="text-[var(--text-primary)] font-medium">{customer.profile?.country || '—'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Phone:</span>
            <span className="text-[var(--text-primary)] font-medium">{customer.profile?.phone || '—'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-muted)]">Joined:</span>
            <span className="text-[var(--text-primary)] font-medium">{new Date(customer.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Account Verification Details */}
        <div className="card p-5 space-y-2 text-xs">
          <h2 className="font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-[var(--text-strong)]" />
            <span>₹30 Verification</span>
          </h2>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Status:</span>
            <span className="badge badge-default text-[10px]">{verStatus}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Fee Paid:</span>
            <span className="font-bold text-[var(--text-strong)] font-mono">{isFeePaid ? 'Yes (₹30)' : 'No'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Paid Date:</span>
            <span className="text-[var(--text-primary)] font-mono">
              {customer.accountVerification?.paidAt
                ? new Date(customer.accountVerification.paidAt).toLocaleDateString()
                : customer.accountRegistrationPaidAt
                ? new Date(customer.accountRegistrationPaidAt).toLocaleDateString()
                : '—'}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Order ID:</span>
            <span className="text-[var(--text-primary)] font-mono text-[11px] truncate max-w-[120px]" title={customer.accountVerification?.razorpayOrderId || ''}>
              {customer.accountVerification?.razorpayOrderId || '—'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-muted)]">Payment ID:</span>
            <span className="text-[var(--text-primary)] font-mono text-[11px] truncate max-w-[120px]" title={customer.accountVerification?.razorpayPaymentId || ''}>
              {customer.accountVerification?.razorpayPaymentId || '—'}
            </span>
          </div>
        </div>

        {/* Fleet & Usage Summary */}
        <div className="card p-5 space-y-2 text-xs">
          <h2 className="font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2 font-mono">
            <CreditCard className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Usage &amp; Fleet</span>
          </h2>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Databases:</span>
            <span className="font-bold text-[var(--text-strong)] font-mono">{instances.length}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Total Invoices:</span>
            <span className="text-[var(--text-primary)] font-mono font-medium">{invoices.length}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Support Tickets:</span>
            <span className="text-[var(--text-primary)] font-mono font-medium">{tickets.length}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-muted)]">Total Payments:</span>
            <span className="text-[var(--text-primary)] font-mono font-medium">{payments.length}</span>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="px-4 py-3.5 border-b border-[var(--border)] flex justify-between items-center">
          <h2 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Customer Payment History</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Razorpay Order ID</th>
                <th className="px-4 py-3 font-medium">Payment ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--muted)] text-xs font-sans">
                    No payment records on file for this customer.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id.toString()} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-semibold">
                      {p.type === 'account_verification'
                        ? '₹30 Account Verification'
                        : p.type === 'invoice'
                        ? 'Monthly Hosting Invoice'
                        : p.type || 'Payment'}
                    </td>
                    <td className="px-4 py-3 font-bold text-[var(--text-strong)]">
                      {p.amountPaise ? formatPaiseToRupees(p.amountPaise) : `₹${p.amount}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          p.status === 'PAID'
                            ? 'badge-active'
                            : p.status === 'FAILED'
                            ? 'badge-suspended'
                            : 'badge-default'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)]">
                      {p.razorpayOrderId || '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)]">
                      {p.razorpayPaymentId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Managed Databases Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="px-4 py-3.5 border-b border-[var(--border)] flex justify-between items-center">
          <h2 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Associated Database Instances</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Instance</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Billing State</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--muted)] text-xs font-sans">
                    No database instances deployed by this customer.
                  </td>
                </tr>
              ) : (
                instances.map((inst) => {
                  const isBillingActive =
                    (inst.status === 'ACTIVE' || inst.status === 'RUNNING') &&
                    inst.billingStartedAt &&
                    !inst.billingStoppedAt;

                  return (
                    <tr key={inst._id.toString()} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[var(--text-strong)] text-xs font-sans">{inst.name}</div>
                        <div className="font-mono text-[11px] text-[var(--muted)]">{inst._id.toString()}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-secondary)] font-semibold">
                          {inst.planName || (inst.planId === 'dedicated' ? 'Dedicated' : 'Shared')}
                        </span>
                        <span className="text-[11px] text-[var(--muted)] block mt-0.5 font-mono">
                          {formatPaiseToRupees(inst.hourlyRatePaise || 100)}/hr
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`badge ${
                            inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                              ? 'badge-active'
                              : inst.status === 'SUSPENDED'
                              ? 'badge-suspended'
                              : 'badge-default'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {isBillingActive ? (
                          <span className="badge badge-active text-[10px]">Active</span>
                        ) : inst.status === 'SUSPENDED' ? (
                          <span className="badge badge-suspended text-[10px]">Paused</span>
                        ) : (
                          <span className="badge badge-default text-[10px]">Stopped</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--muted)] font-mono">
                        {new Date(inst.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/databases/${inst._id.toString()}`}
                          className="btn-secondary py-1 px-2.5 min-h-[30px] text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
