import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication, ManagedDatabase, Subscription, SupportTicket, AuditLog } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Admin Overview' };

export default async function AdminDashboardPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [
    totalUsers,
    pendingApps,
    activeDbs,
    openTickets,
    recentAudit,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    HostingApplication.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
    ManagedDatabase.countDocuments({ status: 'ACTIVE' }),
    SupportTicket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] } }),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Admin Control Center</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage applications, provisioning, billing, and customer support
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/customers" className="card hover:border-[var(--accent)] transition-colors">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Customers</span>
          <p className="text-2xl font-semibold text-[var(--text-primary)] mt-2">{totalUsers}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Registered accounts</span>
        </Link>

        <Link href="/admin/applications" className="card hover:border-[var(--accent)] transition-colors">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Pending Applications</span>
          <p className={`text-2xl font-semibold mt-2 ${pendingApps > 0 ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
            {pendingApps}
          </p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Requires manual review</span>
        </Link>

        <Link href="/admin/provisioning" className="card hover:border-[var(--accent)] transition-colors">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Active Databases</span>
          <p className="text-2xl font-semibold text-green-400 mt-2">{activeDbs}</p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Managed deployments</span>
        </Link>

        <Link href="/admin/support" className="card hover:border-[var(--accent)] transition-colors">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Open Tickets</span>
          <p className={`text-2xl font-semibold mt-2 ${openTickets > 0 ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
            {openTickets}
          </p>
          <span className="text-xs text-[var(--text-secondary)] mt-1 block">Customer inquiries</span>
        </Link>
      </div>

      {/* Quick Action links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Onboarding Pipeline</h3>
          <p className="text-xs text-[var(--text-secondary)]">Review submitted hosting applications and advance stages.</p>
          <Link href="/admin/applications" className="btn-secondary text-xs inline-block">
            Go to Applications →
          </Link>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Provisioning</h3>
          <p className="text-xs text-[var(--text-secondary)]">Deploy managed instances for customers who accepted legal terms.</p>
          <Link href="/admin/provisioning" className="btn-secondary text-xs inline-block">
            Open Provisioning →
          </Link>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Billing &amp; Payments</h3>
          <p className="text-xs text-[var(--text-secondary)]">Record offline payments and monitor monthly subscriptions.</p>
          <Link href="/admin/billing" className="btn-secondary text-xs inline-block">
            Manage Billing →
          </Link>
        </div>
      </div>

      {/* Recent Audit Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Recent Audit Activity
          </h2>
          <Link href="/admin/audit" className="text-xs text-[var(--accent)] hover:underline">
            View full log →
          </Link>
        </div>

        <div className="space-y-0 divide-y divide-[var(--border)] text-xs">
          {recentAudit.map((log) => (
            <div key={log._id.toString()} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="badge badge-default font-mono">{log.action}</span>
                <span className="text-[var(--text-secondary)] truncate">
                  {log.entityType ? `${log.entityType} ${log.entityId || ''}` : log.actorRole || 'system'}
                </span>
              </div>
              <span className="text-[var(--text-muted)] shrink-0">
                {new Date(log.createdAt).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

