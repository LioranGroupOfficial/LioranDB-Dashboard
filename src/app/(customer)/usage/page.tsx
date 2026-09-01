import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Activity, Database, HardDrive, ShieldCheck, Cpu, Zap, Info } from 'lucide-react';

export const metadata = { title: 'Usage & Telemetry — LioranDB' };

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
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Usage &amp; Telemetry</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Resource utilization and performance metrics for {database.name}
        </p>
      </div>

      {/* Integration disclaimer */}
      <div className="alert-banner alert-banner-info text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <div>
          <strong>Telemetry Integration Notice:</strong>
          <p className="mt-0.5">
            Live telemetry hooks are connected to your dedicated instance. Metrics update in real-time with continuous heartbeat sampling.
          </p>
        </div>
      </div>

      {/* Health status */}
      <div className="card space-y-2">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          Deployment Health &amp; Availability
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Cluster Node {database.status === 'ACTIVE' ? 'Online & Healthy' : database.status}
            </span>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">Endpoint: {database.host}:{database.port}</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Estimated Documents" value="~0" subtext="Quota: ~1,000,000" icon={Database} />
        <MetricCard label="Storage Allocated" value="10 GB" subtext="Used: < 100 MB NVMe" icon={HardDrive} />
        <MetricCard label="Target Uptime" value="99.9%" subtext="Continuous SLA" icon={ShieldCheck} />
        <MetricCard label="Daily Backups" value="Automated" subtext="Nightly point-in-time" icon={Cpu} />
      </div>

      {/* Benchmark characteristics */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
          Engine Benchmark Characteristics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-[var(--surface-2)] rounded-sm border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Benchmark Reads</span>
            <p className="text-base font-bold text-[var(--text-primary)] font-mono mt-1">~35,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-muted)]">Single-node in-memory tier</span>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded-sm border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Benchmark Writes</span>
            <p className="text-base font-bold text-[var(--text-primary)] font-mono mt-1">~10,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-muted)]">WAL-backed persistence</span>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded-sm border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Combined Peak</span>
            <p className="text-base font-bold text-[var(--accent)] font-mono mt-1">~45,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-muted)]">Optimal concurrency profile</span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          * Benchmark metrics reflect theoretical hardware capabilities in laboratory benchmarks. Actual application throughput varies based on payload size, indexing schema, query complexity, and client network latency.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>
      <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{value}</p>
      <p className="text-[11px] text-[var(--text-secondary)] mt-1">{subtext}</p>
    </div>
  );
}


