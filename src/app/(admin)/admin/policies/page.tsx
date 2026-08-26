import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, PolicyDocument, PolicyAcceptance } from '@/lib/db';

export const metadata = { title: 'Policy Documents — Admin' };

export default async function AdminPoliciesPage() {
  await requireRole('admin');
  await connectToDatabase();

  const [policies, acceptanceCounts] = await Promise.all([
    PolicyDocument.find().sort({ slug: 1, version: -1 }).lean(),
    PolicyAcceptance.aggregate([
      {
        $group: {
          _id: { slug: '$policySlug', version: '$policyVersion' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const countMap = new Map<string, number>();
  acceptanceCounts.forEach((item) => {
    countMap.set(`${item._id.slug}:${item._id.version}`, item.count);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Legal Policies</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Version-controlled customer terms and legal agreements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {policies.map((p) => {
          const acceptedCount = countMap.get(`${p.slug}:${p.version}`) || 0;
          return (
            <div key={p._id.toString()} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">{p.title}</h2>
                    <span className="badge badge-default text-xs font-mono">v{p.version}</span>
                    {p.active && <span className="badge badge-active text-xs">Active</span>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">Slug: {p.slug}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--text-muted)]">Acceptances:</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{acceptedCount} users</p>
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-2)] rounded border border-[var(--border)] max-h-40 overflow-y-auto">
                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-sans leading-relaxed">
                  {p.content}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                <span>Effective from: {new Date(p.effectiveAt).toLocaleDateString('en-IN')}</span>
                <span className="font-mono text-[10px]">Hash: {p.contentHash.slice(0, 16)}...</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

