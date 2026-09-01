import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Subscription, Payment } from '@/lib/db';
import { redirect } from 'next/navigation';
import { formatCurrency, getBillingStatus, formatDateIST } from '@/lib/billing';
import SubmitPaymentProofModal from '@/components/customer/SubmitPaymentProofModal';
import { CreditCard, ExternalLink, Clock, CheckCircle2, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

export const metadata = { title: 'Billing & Invoices' };

export default async function BillingPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const allowedStages = ['PROVISIONING', 'ACTIVE', 'SUSPENDED'];
  if (!allowedStages.includes(user.onboardingStage)) redirect('/dashboard');

  const [subscription, payments] = await Promise.all([
    Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const billingStatus = subscription
    ? getBillingStatus({
        subscriptionStatus: subscription.status,
        nextPaymentDate: subscription.nextPaymentDate,
      })
    : null;

  const pendingPayments = payments.filter((p) => p.status === 'PENDING' || p.status === 'SUBMITTED');
  const pastPayments = payments.filter((p) => p.status === 'PAID' || p.status === 'FAILED');

  const serializedPending = pendingPayments.map((p) => ({
    id: p._id.toString(),
    amount: p.amount,
    currency: p.currency,
    billingMonth: p.billingMonth,
    razorpayPaymentLink: p.razorpayPaymentLink,
    status: p.status,
    submittedReference: p.submittedReference,
    dueDate: p.dueDate ? p.dueDate.toISOString() : undefined,
    verificationNotes: p.verificationNotes,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Billing &amp; Invoices</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Manage your monthly cluster hosting invoices, Razorpay payments, and payment verification
          </p>
        </div>
      </div>

      {/* Pending / Actionable Invoices Banner */}
      {serializedPending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Action Required: Monthly Hosting Invoices ({serializedPending.length})
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {serializedPending.map((inv) => (
              <div
                key={inv.id}
                className="card border-amber-900/60 bg-[#161208] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {inv.billingMonth || 'Monthly Hosting Invoice'}
                    </span>
                    <span
                      className={`badge ${
                        inv.status === 'SUBMITTED' ? 'badge-pending' : 'badge-suspended'
                      }`}
                    >
                      {inv.status === 'SUBMITTED' ? 'Awaiting Admin Verification' : 'Payment Due'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Amount Due:{' '}
                    <span className="font-mono text-emerald-400 font-bold text-sm">
                      {formatCurrency(inv.amount, inv.currency)}
                    </span>
                    {inv.dueDate && (
                      <span className="text-[var(--text-muted)] ml-2">
                        Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </p>
                  {inv.submittedReference && (
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      Submitted Ref: <span className="text-amber-300 font-bold">{inv.submittedReference}</span>
                    </p>
                  )}
                  {inv.verificationNotes && (
                    <p className="text-[11px] text-red-400">
                      Note: {inv.verificationNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {inv.razorpayPaymentLink && (
                    <a
                      href={inv.razorpayPaymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <span>Pay via Razorpay</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <SubmitPaymentProofModal payment={inv} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!subscription ? (
        <div className="card">
          <p className="text-xs text-[var(--text-secondary)]">
            Subscription information will appear here once your cluster deployment is active.
          </p>
        </div>
      ) : (
        <>
          {/* Current Plan */}
          <div className="card">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[var(--accent)]" />
              Active Subscription Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-[var(--text-muted)]">Plan Tier</p>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                  {subscription.planName}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Monthly Rate</p>
                <p className="text-sm font-mono font-semibold text-[var(--accent)] mt-0.5">
                  {formatCurrency(subscription.amount, subscription.currency)}/mo
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Deployment Status</p>
                <span
                  className={`badge mt-1 ${
                    subscription.status === 'ACTIVE'
                      ? 'badge-active'
                      : subscription.status === 'SUSPENDED'
                      ? 'badge-suspended'
                      : 'badge-pending'
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              {subscription.nextPaymentDate && (
                <div>
                  <p className="text-[var(--text-muted)]">Next Billing Date</p>
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                    {formatDateIST(new Date(subscription.nextPaymentDate))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Billing notice */}
          <div className="alert-banner alert-banner-info text-xs">
            Invoices are attached monthly with a direct Razorpay payment link. After paying on Razorpay, submit your transaction ID / payment reference for immediate admin verification.
          </div>

          {/* Payment history */}
          <div className="card space-y-4">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Payment &amp; Invoice History ({payments.length})
            </h2>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase">
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Period / Description</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Reference ID</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {payments.map((p) => (
                    <tr key={p._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                      <td className="py-3 text-[var(--text-muted)] font-mono">
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 text-[var(--text-primary)] font-medium">
                        {p.billingMonth || (p.periodStart ? formatDateIST(new Date(p.periodStart)) : 'Monthly Hosting')}
                      </td>
                      <td className="py-3 font-mono text-[var(--text-primary)] font-semibold">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                        {p.transactionReference || p.submittedReference || '—'}
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
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                        No payment records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

