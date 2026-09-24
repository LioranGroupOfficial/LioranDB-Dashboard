import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, Subscription, Payment, User } from '@/lib/db';
import { formatCurrency, formatDateIST } from '@/lib/billing';
import RecordPaymentModal from '@/components/admin/RecordPaymentModal';
import AttachPaymentLinkModal from '@/components/admin/AttachPaymentLinkModal';
import VerifyPaymentModal from '@/components/admin/VerifyPaymentModal';
import { CreditCard, DollarSign, Users, Clock, ExternalLink } from 'lucide-react';

export const metadata = { title: 'Billing & Payments — Admin' };

export default async function AdminBillingPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [subscriptions, payments, allCustomers] = await Promise.all([
    Subscription.find()
      .populate('userId', 'email profile')
      .populate('databaseId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    Payment.find()
      .populate('userId', 'email profile')
      .populate('subscriptionId', 'planName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    User.find({ role: 'customer' })
      .select('email profile onboardingStage')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const activeSubCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const mrr = activeSubCount * 5000;
  const pendingVerificationCount = payments.filter((p) => p.status === 'SUBMITTED').length;

  const customerOptions = allCustomers.map((c) => {
    const sub = subscriptions.find((s) => s.userId && (s.userId as unknown as { _id: { toString(): string } })._id?.toString() === c._id.toString());
    return {
      id: c._id.toString(),
      name: c.profile?.fullName || c.email.split('@')[0],
      email: c.email,
      subscriptionId: sub?._id?.toString(),
    };
  });

  const serializedSubs = subscriptions.map((s) => {
    const user = s.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
    const db = s.databaseId as unknown as { _id: string; name: string } | null;
    return {
      id: s._id.toString(),
      customerEmail: user?.email || 'Unknown',
      customerName: user?.profile?.fullName || 'Customer',
      userId: user?._id?.toString() || '',
      planName: s.planName,
      amount: s.amount,
      currency: s.currency,
      status: s.status,
      databaseName: db?.name || '—',
      nextPaymentDate: s.nextPaymentDate ? s.nextPaymentDate.toISOString() : undefined,
      currentPeriodStart: s.currentPeriodStart ? s.currentPeriodStart.toISOString() : undefined,
    };
  });

  const serializedPayments = payments.map((p) => {
    const user = p.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
    return {
      id: p._id.toString(),
      customerName: user?.profile?.fullName || 'Customer',
      customerEmail: user?.email || 'Unknown',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      billingMonth: p.billingMonth,
      razorpayPaymentLink: p.razorpayPaymentLink,
      submittedReference: p.submittedReference,
      submittedAt: p.submittedAt ? p.submittedAt.toISOString() : undefined,
      transactionReference: p.transactionReference,
      notes: p.notes,
      verificationNotes: p.verificationNotes,
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal font-serif text-[var(--text-primary)] tracking-tight">Billing &amp; Payments</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Attach monthly Razorpay links, monitor customer transactions, and verify payment settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AttachPaymentLinkModal customers={customerOptions} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] uppercase tracking-wider font-medium">Active Deployments</span>
            <Users className="w-4 h-4 text-[var(--success)]" />
          </div>
          <p className="text-3xl font-normal font-serif text-[var(--success)] mt-2">{activeSubCount}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">₹5,000/mo per cluster</span>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] uppercase tracking-wider font-medium">MRR Run-Rate</span>
            <DollarSign className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <p className="text-3xl font-normal font-serif text-[var(--primary)] mt-2">{formatCurrency(mrr, 'INR')}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">Monthly recurring revenue</span>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] uppercase tracking-wider font-medium">Awaiting Verification</span>
            <Clock className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <p className="text-3xl font-normal font-serif text-[var(--warning)] mt-2">{pendingVerificationCount}</p>
          <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">Submitted customer payments</span>
        </div>
      </div>

      {/* Payment Ledger & Verification Queue */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[var(--primary)]" />
            Payment Invoices &amp; Verification Queue ({serializedPayments.length})
          </h2>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-[var(--muted)] uppercase">
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Month</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Razorpay Link</th>
                <th className="pb-3 font-semibold">Submitted Reference / UTR</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {serializedPayments.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--surface-card)]/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-[var(--text-primary)]">{p.customerName}</div>
                    <div className="text-[11px] text-[var(--muted)] font-mono">{p.customerEmail}</div>
                  </td>
                  <td className="py-3 text-[var(--text-primary)] font-medium">
                    {p.billingMonth || '—'}
                  </td>
                  <td className="py-3 font-mono text-[var(--text-primary)] font-semibold">
                    {formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="py-3">
                    {p.razorpayPaymentLink ? (
                      <a
                        href={p.razorpayPaymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                      >
                        <span>Razorpay Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {p.submittedReference ? (
                      <div>
                        <span className="font-mono bg-[var(--surface-card)] px-2 py-0.5 rounded-md border border-[var(--border)] text-[var(--warning)] font-bold">
                          {p.submittedReference}
                        </span>
                        {p.submittedAt && (
                          <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                            Submitted: {new Date(p.submittedAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                    ) : p.transactionReference ? (
                      <span className="font-mono text-[var(--text-secondary)]">{p.transactionReference}</span>
                    ) : (
                      <span className="text-[var(--muted)] italic">Awaiting customer payment</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        p.status === 'PAID'
                          ? 'badge-active'
                          : p.status === 'SUBMITTED'
                          ? 'badge-pending'
                          : p.status === 'FAILED'
                          ? 'badge-suspended'
                          : 'badge-default'
                      }`}
                    >
                      {p.status === 'SUBMITTED' ? 'NEEDS VERIFICATION' : p.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <VerifyPaymentModal payment={p} />
                  </td>
                </tr>
              ))}
              {serializedPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                    No payment records yet. Click &quot;Attach Monthly Razorpay Link&quot; above to issue an invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
          Active Subscriptions ({serializedSubs.length})
        </h2>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-[var(--muted)] uppercase">
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Cluster / Database</th>
                <th className="pb-3 font-semibold">Rate</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Next Due (IST)</th>
                <th className="pb-3 font-semibold text-right">Manual Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {serializedSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-[var(--surface-card)]/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-[var(--text-primary)]">{sub.customerName}</div>
                    <div className="text-[11px] text-[var(--muted)] font-mono">{sub.customerEmail}</div>
                  </td>
                  <td className="py-3 font-mono text-[var(--text-secondary)]">{sub.databaseName}</td>
                  <td className="py-3 font-mono text-[var(--text-primary)] font-semibold">
                    {formatCurrency(sub.amount, sub.currency)}/mo
                  </td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        sub.status === 'ACTIVE'
                          ? 'badge-active'
                          : sub.status === 'SUSPENDED'
                          ? 'badge-suspended'
                          : 'badge-pending'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-3 text-[var(--text-secondary)]">
                    {sub.nextPaymentDate ? formatDateIST(new Date(sub.nextPaymentDate)) : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <RecordPaymentModal subscription={sub} />
                  </td>
                </tr>
              ))}
              {serializedSubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                    No active subscriptions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
