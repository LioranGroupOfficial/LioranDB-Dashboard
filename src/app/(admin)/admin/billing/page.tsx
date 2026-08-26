import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, Subscription, Payment } from '@/lib/db';
import { formatCurrency, formatDateIST } from '@/lib/billing';
import RecordPaymentModal from '@/components/admin/RecordPaymentModal';

export const metadata = { title: 'Billing — Admin' };

export default async function AdminBillingPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [subscriptions, payments] = await Promise.all([
    Subscription.find()
      .populate('userId', 'email profile')
      .populate('databaseId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    Payment.find()
      .populate('userId', 'email profile')
      .populate('subscriptionId', 'planName')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  const activeSubCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const mrr = activeSubCount * 5000;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Billing &amp; Subscriptions</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage customer subscriptions and record manual monthly payments
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Active Subscriptions</span>
          <p className="text-2xl font-semibold text-green-400 mt-2">{activeSubCount}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">₹5,000/mo per active seat</span>
        </div>
        <div className="card">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Monthly Recurring Revenue</span>
          <p className="text-2xl font-semibold text-[var(--accent)] mt-2">{formatCurrency(mrr, 'INR')}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Expected monthly run-rate</span>
        </div>
        <div className="card">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Recorded Payments</span>
          <p className="text-2xl font-semibold text-[var(--text-primary)] mt-2">{payments.length}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Ledger transaction count</span>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Subscriptions ({serializedSubs.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Database</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Next Due (IST)</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {serializedSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-[var(--text-primary)]">{sub.customerName}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{sub.customerEmail}</div>
                  </td>
                  <td className="py-3 text-xs text-[var(--text-muted)]">{sub.databaseName}</td>
                  <td className="py-3 font-mono text-xs text-[var(--text-primary)]">
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
                  <td className="py-3 text-xs text-[var(--text-secondary)]">
                    {sub.nextPaymentDate ? formatDateIST(new Date(sub.nextPaymentDate)) : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <RecordPaymentModal subscription={sub} />
                  </td>
                </tr>
              ))}
              {serializedSubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                    No active subscriptions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Ledger */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Payment Ledger ({payments.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Reference / Notes</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {payments.map((p) => {
                const user = p.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
                return (
                  <tr key={p._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="py-3 text-xs text-[var(--text-muted)]">
                      {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3">
                      <div className="text-xs font-medium text-[var(--text-primary)]">{user?.profile?.fullName || 'Customer'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{user?.email}</div>
                    </td>
                    <td className="py-3 font-mono text-xs text-[var(--text-primary)]">
                      {formatCurrency(p.amount, p.currency)}
                    </td>
                    <td className="py-3 text-xs text-[var(--text-secondary)]">
                      {p.transactionReference && <span className="font-mono block">Ref: {p.transactionReference}</span>}
                      {p.notes && <span className="text-[var(--text-muted)]">{p.notes}</span>}
                    </td>
                    <td className="py-3">
                      <span className="badge badge-active">{p.status}</span>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                    No payment records yet.
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

