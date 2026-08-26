import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/crypto';
import DatabaseCredentials from '@/components/database/DatabaseCredentials';

export const metadata = { title: 'Managed Database' };

const PLAN_RESOURCES = {
  vCPU: '2 vCPU',
  ram: '4 GB',
  storage: 'Up to 10 GB',
  backups: 'Daily backups',
  iops: '~3,000 IOPS',
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
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Managed Database</h1>
        <div className="card">
          <p className="text-sm text-[var(--text-secondary)]">
            Your managed LioranDB deployment is being prepared. You&apos;ll receive an email and see the details here once it&apos;s ready.
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
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Managed Database</h1>
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
        <div className="alert-banner alert-banner-error">
          <div>
            <strong>Service suspended</strong>
            <p className="text-sm mt-1">{database.suspensionReason}</p>
          </div>
        </div>
      )}

      {/* Resource allocation */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Resource Allocation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(PLAN_RESOURCES).map(([key, value]) => (
            <div key={key}>
              <p className="text-xs text-[var(--text-muted)] capitalize">{key}</p>
              <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connection details */}
      <DatabaseCredentials db={dbData} />

      {/* Studio link */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
          LioranDB Studio
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Connect to your database using LioranDB Studio. Use your connection URI to connect.
        </p>
        <a
          href="https://studio.liorandb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center gap-2"
        >
          Open LioranDB Studio ↗
        </a>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Do not share your connection URI. Never paste it into URLs or public channels.
        </p>
      </div>
    </div>
  );
}
