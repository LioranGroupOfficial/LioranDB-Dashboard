import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/crypto';
import DatabaseCredentials from '@/components/database/DatabaseCredentials';
import { Database, Server, Cpu, HardDrive, ShieldCheck, ExternalLink, Activity } from 'lucide-react';

export const metadata = { title: 'Managed Database — LioranDB' };

const PLAN_RESOURCES = {
  vCPU: '2 Dedicated vCPU',
  ram: '4 GB High-Speed RAM',
  storage: 'Up to 10 GB NVMe',
  backups: 'Automated Daily Snapshots',
  iops: '~3,000 IOPS Guaranteed',
};

export default async function DatabasePage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const allowedStages = ['PROVISIONING', 'ACTIVE', 'SUSPENDED'];
  if (!allowedStages.includes(user.onboardingStage)) {
    redirect('/dashboard');
  }

  const database = await ManagedDatabase.findOne({ customerId: user._id }).lean();

  if (!database) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Managed Database</h1>
        <div className="card">
          <div className="flex items-center gap-2 text-[var(--accent)] mb-2">
            <Server className="w-4 h-4 animate-pulse" />
            <span className="font-semibold text-xs">Node Provisioning in Progress</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Your managed LioranDB deployment is being prepared. You&apos;ll receive an email and see the connection credentials here once the cluster is online.
          </p>
        </div>
      </div>
    );
  }

  // Decrypt connection URI server-side only — never send raw encrypted value to client
  let connectionUri: string | null = null;
  if (database.encryptedConnectionUri) {
    try {
      connectionUri = decrypt(database.encryptedConnectionUri);
    } catch {
      connectionUri = null;
    }
  }

  const dbData = {
    id: database._id.toString(),
    name: database.name,
    status: database.status,
    host: database.host,
    port: database.port,
    databaseName: database.databaseName,
    username: database.username,
    connectionUri,
    planId: database.planId,
    passwordChangeRequired: database.passwordChangeRequired,
    temporaryCredentialExpiresAt: database.temporaryCredentialExpiresAt?.toISOString(),
    provisionedAt: database.provisionedAt?.toISOString(),
    suspendedAt: database.suspendedAt?.toISOString(),
    suspensionReason: database.suspensionReason,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Managed Database Cluster</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            High-performance ACID compliant multi-model instance with dedicated TLS termination
          </p>
        </div>
        <span
          className={`badge ${
            database.status === 'ACTIVE'
              ? 'badge-active'
              : database.status === 'SUSPENDED'
              ? 'badge-suspended'
              : 'badge-pending'
          }`}
        >
          {database.status}
        </span>
      </div>

      {database.status === 'SUSPENDED' && database.suspensionReason && (
        <div className="alert-banner alert-banner-error text-xs">
          <div>
            <strong>Service Suspended:</strong>
            <p className="mt-1">{database.suspensionReason}</p>
          </div>
        </div>
      )}

      {/* Resource allocation */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
          Hardware &amp; Engine Allocation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {Object.entries(PLAN_RESOURCES).map(([key, value]) => (
            <div key={key}>
              <p className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{key}</p>
              <p className="text-xs text-[var(--text-primary)] font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connection details */}
      <DatabaseCredentials db={dbData} />

      {/* Studio link */}
      <div className="card space-y-3">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
          LioranDB Studio &amp; Query Console
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Connect to your multi-model database using LioranDB Studio visual query workspace.
        </p>
        <div>
          <a
            href="https://studio.liorandb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <span>Launch LioranDB Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          Never share your database master credentials in public repositories or unencrypted channels.
        </p>
      </div>
    </div>
  );
}

