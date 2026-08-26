import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Subscription, Payment } from '@/lib/db';
import { redirect } from 'next/navigation';
import { formatCurrency, getBillingStatus, formatDateIST } from '@/lib/billing';

export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const allowedStages = ['PROVISIONING', 'ACTIVE', 'SUSPENDED'];
  if (!allowedStages.includes(user.onboardingStage)) redirect('/dashboard');

  const [subscription, payments] = await Promise.all([
    Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(12).lean(),
  ]);

  const billingStatus = subscription
    ? getBillingStatus({
        subscriptionStatus: subscription.status,
        nextPaymentDate: subscription.nextPaymentDate,
      })
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Billing</h1>

      {!subscription ? (
        <div className="card">
          <p className="text-sm text-[var(--text-secondary)]">
            Subscription information will appear here once your deployment is active.
          </p>
        </div>
      ) : (
        <>
          {/* Current Plan */}
          <div className="card">
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
              Current Plan
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Plan</p>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                  {subscription.planName}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Monthly rate</p>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                  {formatCurrency(subscription.amount, subscription.currency)}/month
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Status</p>
                <span
                  className={`badge mt-0.5 ${
                    subscription.status === 'ACTIVE'
                      ? 'badge-active'
                      : subscription.status === 'SUSPENDED' || subscription.status === 'CANCELLED'
                      ? 'badge-suspended'
                      : 'badge-pending'
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              {subscription.startedAt && (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Started</p>
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                    {formatDateIST(new Date(subscription.startedAt))}
                  </p>
                </div>
              )}
              {subscription.currentPeriodStart && (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Current period</p>
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                    {formatDateIST(new Date(subscription.currentPeriodStart))}
                    {' – '}
                    {subscription.currentPeriodEnd
                      ? formatDateIST(new Date(subscription.currentPeriodEnd))
                      : '—'}
                  </p>
                </div>
              )}
              {subscription.nextPaymentDate && (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Next payment</p>
                  <p
                    className={`text-sm font-medium mt-0.5 ${
                      billingStatus === 'DUE' || billingStatus === 'PAST_DUE'
                        ? 'text-[var(--error)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {formatDateIST(new Date(subscription.nextPaymentDate))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Billing notice */}
          <div className="alert-banner alert-banner-info text-sm">
            Payments are due on the 1st of each month (IST). Contact support if you have questions about your billing.
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
                Payment History
              </h2>
              <div className="space-y-0 divide-y" style={{ borderColor: 'var(--border)' }}>
                {payments.map((payment) => (
                  <div key={payment._id.toString()} className="flex items-center justify-between py-3 gap-4">
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">
                        {payment.periodStart
                          ? formatDateIST(new Date(payment.periodStart))
                          : 'Payment'}
                      </p>
                      {payment.transactionReference && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Ref: {payment.transactionReference}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[var(--text-primary)] font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <span
                        className={`badge ${
                          payment.status === 'PAID'
                            ? 'badge-active'
                            : payment.status === 'PENDING'
                            ? 'badge-pending'
                            : 'badge-suspended'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payments.length === 0 && (
            <div className="card">
              <p className="text-sm text-[var(--text-secondary)]">No payment records yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
