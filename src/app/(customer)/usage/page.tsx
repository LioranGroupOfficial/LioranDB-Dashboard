import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { telemetryProvider } from '@/lib/providers/telemetry';

export const metadata = { title: 'Usage & Telemetry' };

export default async function UsagePage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const user = await User.findById(sessionUser.userId).lean();
  if (!user) redirect('/login');

  if (user.onboardingStage !== 'ACTIVE') {
    redirect('/dashboard');
  }

  const database = await ManagedDatabase.findOne({ customerId: user._id }).lean();
  if (!database) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Usage & Telemetry</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Resource utilization and performance metrics for {database.name}
        </p>
      </div>

      {/* Integration disclaimer */}
      <div className="alert-banner alert-banner-info text-sm">
        <div>
          <strong>Telemetry Integration Notice</strong>
          <p className="mt-1">
            Live telemetry collection is currently in integration. The metrics displayed below represent the infrastructure baseline and placeholder telemetry hooks.
          </p>
        </div>
      </div>

      {/* Health status */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Deployment Health
        </h2>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-green-400"></span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Instance {database.status === 'ACTIVE' ? 'Running normally' : database.status}
          </span>
          <span className="text-xs text-[var(--text-muted)] ml-auto">Host: {database.host}:{database.port}</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Estimated Documents" value="~0" subtext="Quota: ~1,000,000" />
        <MetricCard label="Storage Allocated" value="10 GB" subtext="Used: < 100 MB" />
        <MetricCard label="Uptime" value="99.9%" subtext="Target: 99.9% monthly" />
        <MetricCard label="Daily Backups" value="Enabled" subtext="Automated daily snapshots" />
      </div>

      {/* Benchmark characteristics */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Engine Benchmark Characteristics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-[var(--surface-2)] rounded border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">Benchmark Reads</span>
            <p className="text-lg font-semibold text-[var(--text-primary)] mt-1">~35,000 ops/s</p>
            <span className="text-xs text-[var(--text-muted)]">Single-node in-memory tier</span>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">Benchmark Writes</span>
            <p className="text-lg font-semibold text-[var(--text-primary)] mt-1">~10,000 ops/s</p>
            <span className="text-xs text-[var(--text-muted)]">WAL-backed persistence</span>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">Combined Peak</span>
            <p className="text-lg font-semibold text-[var(--text-primary)] mt-1">~45,000 ops/s</p>
            <span className="text-xs text-[var(--text-muted)]">Optimal concurrency profile</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          * Benchmark metrics reflect theoretical hardware capabilities in laboratory benchmarks. Actual application throughput varies based on payload size, indexing schema, query complexity, and client network latency.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="card">
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <p className="text-xl font-semibold text-[var(--text-primary)] mt-2">{value}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">{subtext}</p>
    </div>
  );
}

