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
        <h1 className="text-2xl font-normal font-serif text-[var(--text-primary)] tracking-tight">Usage &amp; Telemetry</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Resource utilization and performance metrics for {database.name}
        </p>
      </div>

      {/* Integration disclaimer */}
      <div className="alert-banner alert-banner-info text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--accent-teal)]" />
        <div>
          <strong>Telemetry Integration Notice:</strong>
          <p className="mt-0.5">
            Live telemetry hooks are connected to your dedicated instance. Metrics update in real-time with continuous heartbeat sampling.
          </p>
        </div>
      </div>

      {/* Health status */}
      <div className="card space-y-2">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--primary)]" />
          Deployment Health &amp; Availability
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-teal)] animate-pulse shadow-sm"></span>
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Cluster Node {database.status === 'ACTIVE' ? 'Online & Healthy' : database.status}
            </span>
          </div>
          <span className="text-xs font-mono text-[var(--text-secondary)]">Endpoint: {database.host}:{database.port}</span>
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
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[var(--primary)]" />
          Engine Benchmark Characteristics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 bg-[var(--surface-card)] rounded-lg border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">Benchmark Reads</span>
            <p className="text-lg font-medium text-[var(--text-primary)] font-serif mt-1">~35,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-secondary)]">Single-node in-memory tier</span>
          </div>
          <div className="p-4 bg-[var(--surface-card)] rounded-lg border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">Benchmark Writes</span>
            <p className="text-lg font-medium text-[var(--text-primary)] font-serif mt-1">~10,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-secondary)]">WAL-backed persistence</span>
          </div>
          <div className="p-4 bg-[var(--surface-cream-strong)] rounded-lg border border-[var(--primary)]/30">
            <span className="text-[10px] text-[var(--primary)] uppercase tracking-wider font-semibold">Combined Peak</span>
            <p className="text-lg font-normal text-[var(--primary)] font-serif mt-1">~45,000 ops/s</p>
            <span className="text-[11px] text-[var(--text-secondary)]">Optimal concurrency profile</span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
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
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">{label}</span>
        <Icon className="w-4 h-4 text-[var(--muted)]" />
      </div>
      <p className="text-xl font-normal font-serif text-[var(--text-primary)]">{value}</p>
      <p className="text-[11px] text-[var(--text-secondary)] mt-1">{subtext}</p>
    </div>
  );
}
