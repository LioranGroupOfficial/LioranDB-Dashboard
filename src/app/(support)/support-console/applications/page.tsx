import { requireAnyRole } from '@/lib/auth/guards';
import { connectToDatabase, HostingApplication } from '@/lib/db';
import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Application Reviews — Developer Support' };

export default async function SupportApplicationsPage() {
  await requireAnyRole(['admin', 'support']);
  await connectToDatabase();

  const applications = await HostingApplication.find()
    .populate('userId', 'email onboardingStage')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Application Reviews</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Review customer hosting use-cases, verify infrastructure requirements, and approve or reject with feedback
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase">
              <th className="pb-3 font-semibold">Applicant / Project</th>
              <th className="pb-3 font-semibold">Stage</th>
              <th className="pb-3 font-semibold">Status</th>
              <th className="pb-3 font-semibold">Documents &amp; Storage</th>
              <th className="pb-3 font-semibold">Submitted</th>
              <th className="pb-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {applications.map((app) => (
              <tr key={app._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                <td className="py-3">
                  <div className="font-semibold text-[var(--text-primary)]">{app.companyName}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">{app.fullName} ({app.workEmail})</div>
                </td>
                <td className="py-3 text-[var(--text-secondary)]">{app.stage}</td>
                <td className="py-3">
                  <span
                    className={`badge ${
                      app.status === 'APPROVED'
                        ? 'badge-active'
                        : app.status === 'REJECTED'
                        ? 'badge-suspended'
                        : 'badge-pending'
                    }`}
                  >
                    {app.status}
                  </span>
                </td>
                <td className="py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                  {app.expectedDocumentCount} docs / {app.estimatedStorage}
                </td>
                <td className="py-3 text-[var(--text-muted)] font-mono">
                  {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/applications/${app._id.toString()}`}
                    className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                  >
                    <span>Review</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                  No hosting applications in queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

