import { requireRole } from '@/lib/auth/guards';
import { connectToDatabase, HostingApplication, User } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ApplicationReviewForm from '@/components/admin/ApplicationReviewForm';

export const metadata = { title: 'Review Application — Admin' };

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;

  await connectToDatabase();
  const app = await HostingApplication.findById(id).populate('userId', 'email onboardingStage').lean();
  if (!app) notFound();

  const user = app.userId as unknown as { _id: string; email: string; onboardingStage: string } | null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/admin/applications" className="hover:text-[var(--text-primary)]">
          ← Back to Applications
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <span className="text-xs text-[var(--text-muted)]">Application #{app.version}</span>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mt-1">{app.companyName}</h1>
          <p className="text-sm text-[var(--text-secondary)]">Applicant: {app.fullName} ({app.workEmail})</p>
        </div>
        <span
          className={`badge text-sm ${
            app.status === 'APPROVED'
              ? 'badge-active'
              : app.status === 'REJECTED'
              ? 'badge-suspended'
              : 'badge-pending'
          }`}
        >
          {app.status}
        </span>
      </div>

      {/* Overview Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Company &amp; Stage</h2>
          <DetailRow label="Company Name" value={app.companyName} />
          <DetailRow label="Stage" value={app.stage} />
          <DetailRow label="Country" value={app.country} />
          <DetailRow label="Phone" value={app.phone || '—'} />
          <DetailRow label="Website" value={app.website || '—'} isLink />
          <div className="pt-2 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">Description:</span>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{app.description}</p>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Workload &amp; Pricing</h2>
          <DetailRow label="Document Count" value={app.expectedDocumentCount} />
          <DetailRow label="Monthly Users" value={app.expectedMonthlyUsers} />
          <DetailRow label="Read Traffic" value={app.readTrafficLevel} />
          <DetailRow label="Write Traffic" value={app.writeTrafficLevel} />
          <DetailRow label="Storage" value={app.estimatedStorage} />
          <DetailRow label="Production Use" value={app.isProduction ? 'Yes (Production)' : 'No (Development)'} />
          <DetailRow label="Pricing (₹5,000/mo)" value={app.pricingResponse.toUpperCase()} highlight />
        </div>
      </div>

      {/* Use Case Narrative */}
      <div className="card space-y-4">
        <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Use Case Narrative</h2>
        <div>
          <span className="text-xs text-[var(--text-muted)]">Why LioranDB:</span>
          <p className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-wrap bg-[var(--surface-2)] p-3 rounded border border-[var(--border)]">
            {app.whyLioranDB}
          </p>
        </div>
        <div>
          <span className="text-xs text-[var(--text-muted)]">Application Architecture &amp; Use:</span>
          <p className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-wrap bg-[var(--surface-2)] p-3 rounded border border-[var(--border)]">
            {app.appDescription}
          </p>
        </div>
      </div>

      {/* Review Actions Form */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Review Decision
        </h2>
        <ApplicationReviewForm
          applicationId={app._id.toString()}
          currentStatus={app.status}
          initialNotes={app.reviewNotes || ''}
          initialRejectionReason={app.rejectionReason || ''}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value, isLink, highlight }: { label: string; value: string; isLink?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      {isLink && value !== '—' ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-[200px]">
          {value}
        </a>
      ) : (
        <span className={`font-medium ${highlight ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-primary)]'}`}>
          {value}
        </span>
      )}
    </div>
  );
}

