import { ArrowRightLeft } from 'lucide-react';
import { liorandbToMongodbPrompt, mongodbToLiorandbPrompt } from '@/lib/migration-prompts';
import CopyButton from './CopyButton';

export default function DatabaseMigration() {
  return (
    <section aria-label="Migration" className="card space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
          <ArrowRightLeft aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          Migration
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Copy a migration prompt and paste it into your AI coding agent.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
          <CopyButton
            value={liorandbToMongodbPrompt}
            label="LioranDB → MongoDB"
            ariaLabel="Copy LioranDB to MongoDB migration prompt for an AI coding agent"
          />
        </span>
        <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
          <CopyButton
            value={mongodbToLiorandbPrompt}
            label="MongoDB → LioranDB"
            ariaLabel="Copy MongoDB to LioranDB migration prompt for an AI coding agent"
          />
        </span>
      </div>
    </section>
  );
}
