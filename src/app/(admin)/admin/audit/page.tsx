import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, AuditLog } from '@/lib/db';

export const metadata = { title: 'Audit Log — Admin' };

export default async function AdminAuditPage() {
  await requireRole('admin');
  await connectToDatabase();

  const logs = await AuditLog.find()
    .populate('actorId', 'email role')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">System Audit Log</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Immutable, append-only security and administrative audit trail (showing latest 100 entries)
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase">
              <th className="pb-3 font-medium">Timestamp (IST)</th>
              <th className="pb-3 font-medium">Action</th>
              <th className="pb-3 font-medium">Actor</th>
              <th className="pb-3 font-medium">Target Entity</th>
              <th className="pb-3 font-medium">IP Address</th>
              <th className="pb-3 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] font-mono">
            {logs.map((log) => {
              const actor = log.actorId as unknown as { _id: string; email: string; role: string } | null;
              return (
                <tr key={log._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                  <td className="py-2.5 text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td className="py-2.5">
                    <span className="badge badge-default font-bold text-[10px]">{log.action}</span>
                  </td>
                  <td className="py-2.5 text-[var(--text-secondary)]">
                    {actor?.email || log.actorRole || 'system'}
                  </td>
                  <td className="py-2.5 text-[var(--text-secondary)]">
                    {log.entityType ? `${log.entityType}:${(log.entityId || '').slice(-6)}` : '—'}
                  </td>
                  <td className="py-2.5 text-[var(--text-muted)]">{log.ip || '—'}</td>
                  <td className="py-2.5 text-[var(--text-muted)] max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm font-sans text-[var(--text-secondary)]">
                  No audit logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

