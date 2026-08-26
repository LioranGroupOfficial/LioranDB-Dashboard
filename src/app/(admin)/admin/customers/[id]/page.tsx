import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Subscription, Payment, SupportTicket, HostingApplication } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Customer Details — Admin' };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;

  await connectToDatabase();
  const [customer, database, subscription, payments, tickets, applications] = await Promise.all([
    User.findById(id).select('-passwordHash').lean(),
    ManagedDatabase.findOne({ customerId: id }).lean(),
    Subscription.findOne({ userId: id }).lean(),
    Payment.find({ userId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
    HostingApplication.find({ userId: id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!customer) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/admin/customers" className="hover:text-[var(--text-primary)]">
          ← Back to Customers
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {customer.profile?.fullName || customer.email}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{customer.email}</p>
        </div>
        <span className="badge badge-pending">{customer.onboardingStage}</span>
      </div>

      {/* Account Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-2 text-xs">
          <h2 className="font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Profile</h2>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Company:</span><span>{customer.profile?.company || '—'}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Country:</span><span>{customer.profile?.country || '—'}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Phone:</span><span>{customer.profile?.phone || '—'}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Active:</span><span>{customer.isActive ? 'Yes' : 'No'}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Created:</span><span>{new Date(customer.createdAt).toLocaleDateString('en-IN')}</span></div>
        </div>

        <div className="card space-y-2 text-xs">
          <h2 className="font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Infrastructure &amp; Billing</h2>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Managed DB:</span>
            <span className="font-medium text-[var(--text-primary)]">{database ? `${database.name} (${database.status})` : 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Subscription:</span>
            <span className="font-medium text-[var(--text-primary)]">{subscription ? `${subscription.status} (₹${subscription.amount}/mo)` : 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Total Payments:</span>
            <span>{payments.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Open Tickets:</span>
            <span>{tickets.filter((t) => t.status !== 'CLOSED').length}</span>
          </div>
        </div>
      </div>

      {/* Database Quick Actions */}
      {database && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Database Deployment: {database.name}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div><span className="text-[var(--text-muted)]">Host:</span> <span className="font-mono">{database.host}</span></div>
            <div><span className="text-[var(--text-muted)]">Port:</span> <span className="font-mono">{database.port}</span></div>
            <div><span className="text-[var(--text-muted)]">DB Name:</span> <span className="font-mono">{database.databaseName}</span></div>
            <div><span className="text-[var(--text-muted)]">Username:</span> <span className="font-mono">{database.username}</span></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Link href="/admin/provisioning" className="btn-secondary text-xs">
              Open in Provisioning Console →
            </Link>
          </div>
        </div>
      )}

      {/* Applications */}
      {applications.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Application History
          </h2>
          <div className="space-y-1 divide-y divide-[var(--border)] text-xs">
            {applications.map((app) => (
              <div key={app._id.toString()} className="py-2 flex justify-between items-center">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Version #{app.version}</span>
                  <span className="text-[var(--text-muted)] ml-2">({app.stage})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-default">{app.status}</span>
                  <Link href={`/admin/applications/${app._id.toString()}`} className="text-[var(--accent)] hover:underline">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

