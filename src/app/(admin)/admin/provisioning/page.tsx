import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import ProvisionModal from '@/components/admin/ProvisionModal';
import DatabaseActions from '@/components/admin/DatabaseActions';

export const metadata = { title: 'Provisioning — Admin' };

export default async function AdminProvisioningPage() {
  await requireRole('admin');
  await connectToDatabase();

  // Customers in PROVISIONING stage who need deployment
  const readyToProvision = await User.find({ onboardingStage: 'PROVISIONING' })
    .select('email profile onboardingStage')
    .lean();

  // All managed databases
  const databases = await ManagedDatabase.find()
    .populate('customerId', 'email profile')
    .sort({ createdAt: -1 })
    .lean();

  const serializedReady = readyToProvision.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    name: u.profile?.fullName || u.email,
    company: u.profile?.company || 'Company',
  }));

  const serializedDbs = databases.map((d) => {
    const cust = d.customerId as unknown as { _id: string; email: string; profile?: { fullName?: string } } | null;
    return {
      id: d._id.toString(),
      name: d.name,
      customerEmail: cust?.email || 'Unknown',
      customerName: cust?.profile?.fullName || 'Customer',
      host: d.host,
      port: d.port,
      databaseName: d.databaseName,
      username: d.username,
      status: d.status,
      planId: d.planId,
      provisionedAt: d.provisionedAt?.toISOString(),
      suspendedAt: d.suspendedAt?.toISOString(),
      suspensionReason: d.suspensionReason,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Provisioning Console</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Deploy, configure, suspend, and manage customer database instances
          </p>
        </div>
      </div>

      {/* Ready to Provision Queue */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[var(--text-primary)] uppercase tracking-wider">
              Ready for Provisioning ({serializedReady.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Customers who have completed application review and accepted all legal terms.
            </p>
          </div>
        </div>

        {serializedReady.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">No customers currently awaiting provisioning.</p>
        ) : (
          <div className="space-y-2">
            {serializedReady.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-md bg-[var(--surface-2)] border border-[var(--border)]"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{c.email} · {c.company}</p>
                </div>
                <ProvisionModal customer={c} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Deployments */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Managed Deployments ({serializedDbs.length})
        </h2>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
                <th className="pb-3 font-medium">Deployment / Customer</th>
                <th className="pb-3 font-medium">Host / Port</th>
                <th className="pb-3 font-medium">DB Name / User</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {serializedDbs.map((db) => (
                <tr key={db.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-[var(--text-primary)]">{db.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{db.customerName} ({db.customerEmail})</div>
                  </td>
                  <td className="py-3 font-mono text-xs text-[var(--text-secondary)]">
                    {db.host}:{db.port}
                  </td>
                  <td className="py-3 font-mono text-xs text-[var(--text-secondary)]">
                    {db.databaseName} / {db.username}
                  </td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        db.status === 'ACTIVE'
                          ? 'badge-active'
                          : db.status === 'SUSPENDED'
                          ? 'badge-suspended'
                          : 'badge-pending'
                      }`}
                    >
                      {db.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <DatabaseActions db={db} />
                  </td>
                </tr>
              ))}
              {serializedDbs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                    No databases deployed yet.
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

