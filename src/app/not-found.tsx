import Link from 'next/link';
import { Database, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: '404: Node Not Found — LioranDB',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto text-[var(--accent)]">
          <Database className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="badge badge-default font-mono text-xs">Error 404 &bull; Missing Node</span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Page Not Found
          </h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
            The requested resource, database record, or route could not be resolved in the LioranDB cluster topology.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="btn-primary inline-flex items-center justify-center gap-2 w-full py-2.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-xs font-mono text-[var(--text-muted)]">
        LioranDB &bull; High-Performance Cloud Database Platform
      </div>
    </div>
  );
}

