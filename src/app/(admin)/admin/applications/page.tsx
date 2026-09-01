import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, HostingApplication } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Applications — Admin' };

export default async function AdminApplicationsPage() {
  await requireRole('admin');
  await connectToDatabase();

  const applications = await HostingApplication.find()
    .populate('userId', 'email onboardingStage')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Hosting Applications</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review and decide on customer managed hosting requests
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase">
              <th className="pb-3 font-medium">Applicant / Company</th>
              <th className="pb-3 font-medium">Stage</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Pricing</th>
              <th className="pb-3 font-medium">Submitted</th>
              <th className="pb-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {applications.map((app) => (
              <tr key={app._id.toString()} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                <td className="py-3">
                  <div className="font-medium text-[var(--text-primary)]">{app.companyName}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{app.fullName} ({app.workEmail})</div>
                </td>
                <td className="py-3 text-xs text-[var(--text-muted)]">{app.stage}</td>
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
                <td className="py-3 text-xs">
                  <span className="font-mono text-[var(--accent)]">{app.pricingResponse}</span>
                </td>
                <td className="py-3 text-xs text-[var(--text-muted)]">
                  {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/applications/${app._id.toString()}`}
                    className="btn-secondary text-xs px-3 py-1 inline-block"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

