import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication, ManagedDatabase, Subscription } from '@/lib/db';
import Link from 'next/link';
import StatusTimeline from '@/components/dashboard/StatusTimeline';
import type { OnboardingStage } from '@/lib/db/models/User';

export const metadata = {
  title: 'Overview & Dashboard',
  description: 'Overview of your managed LioranDB clusters, onboarding stage, and deployment status.',
};
import {
  UserCheck,
  FileText,
  Server,
  CreditCard,
  Edit3,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  LifeBuoy,
} from 'lucide-react';

export default async function DashboardPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();

  const [user, latestApp, database, subscription] = await Promise.all([
    User.findById(sessionUser.userId).select('-passwordHash').lean(),
    HostingApplication.findOne({ userId: sessionUser.userId })
      .sort({ createdAt: -1 })
      .lean(),
    ManagedDatabase.findOne({ customerId: sessionUser.userId }).lean(),
    Subscription.findOne({ userId: sessionUser.userId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const stage = user?.onboardingStage || 'EMAIL_VERIFICATION';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {user?.profile?.fullName ? `Welcome, ${user.profile.fullName.split(' ')[0]}` : 'Dashboard Overview'}
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            LioranDB Managed Multi-Model Database Hosting &amp; Developer Infrastructure
          </p>
        </div>

        {latestApp && (
          <Link
            href="/application"
            className="btn-secondary text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <FileEdit className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Edit / Reapply Form Settings</span>
          </Link>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          label="Account Status"
          value="Verified Active"
          status="active"
          icon={UserCheck}
          detail={sessionUser.email}
        />
        <StatusCard
          label="Hosting Application"
          value={getApplicationLabel(stage, latestApp?.status)}
          status={getApplicationStatus(stage)}
          icon={FileText}
          detail={
            latestApp?.submittedAt
              ? `Version #${latestApp.version || 1} • ${new Date(latestApp.submittedAt).toLocaleDateString('en-IN')}`
              : undefined
          }
        />
        <StatusCard
          label="Cluster Deployment"
          value={getDeploymentLabel(database?.status)}
          status={getDeploymentStatusBadge(database?.status)}
          icon={Server}
          detail={database?.name || 'Awaiting application approval'}
        />
      </div>

      {/* Onboarding Timeline */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Onboarding &amp; Provisioning Pipeline
        </h2>
        <StatusTimeline stage={stage as OnboardingStage} rejectionReason={latestApp?.rejectionReason} />
      </div>

      {/* Stage-specific Actions */}
      <StageActions
        stage={stage as OnboardingStage}
        applicationId={latestApp?._id?.toString()}
        rejectionReason={latestApp?.rejectionReason}
        version={latestApp?.version}
      />

      {/* Subscription info if active */}
      {subscription && stage === 'ACTIVE' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[var(--accent)]" />
              Active Subscription
            </h2>
            <Link href="/billing" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
              <span>View Invoices &amp; Razorpay Payments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[var(--text-muted)]">Plan</p>
              <p className="text-sm text-[var(--text-primary)] font-semibold mt-0.5">
                {subscription.planName}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Monthly</p>
              <p className="text-sm font-mono text-[var(--accent)] font-semibold mt-0.5">
                ₹5,000/month
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Status</p>
              <span className={`badge badge-${subscription.status === 'ACTIVE' ? 'active' : 'pending'} mt-1`}>
                {subscription.status}
              </span>
            </div>
            {subscription.nextPaymentDate && (
              <div>
                <p className="text-[var(--text-muted)]">Next Payment Due</p>
                <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">
                  {new Date(subscription.nextPaymentDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  status: 'active' | 'pending' | 'suspended' | 'default';
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
      <div className="flex items-center gap-2">
        <span className={`badge badge-${status}`}>{value}</span>
      </div>
      {detail && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 font-mono truncate">{detail}</p>
      )}
    </div>
  );
}

function getApplicationLabel(stage: string, appStatus?: string): string {
  switch (stage) {
    case 'APPLICATION_REQUIRED': return 'Not Submitted';
    case 'APPLICATION_PENDING': return 'Under Review';
    case 'APPLICATION_APPROVED': return 'Approved';
    case 'APPLICATION_REJECTED': return 'Rejected';
    case 'TERMS_REQUIRED': return 'Approved';
    case 'PROVISIONING': return 'Approved';
    case 'ACTIVE': return 'Approved';
    case 'SUSPENDED': return 'Approved';
    default: return 'N/A';
  }
}

function getApplicationStatus(stage: string): 'active' | 'pending' | 'suspended' | 'default' {
  if (['ACTIVE', 'PROVISIONING', 'TERMS_REQUIRED', 'APPLICATION_APPROVED'].includes(stage)) return 'active';
  if (['APPLICATION_PENDING'].includes(stage)) return 'pending';
  if (['APPLICATION_REJECTED'].includes(stage)) return 'suspended';
  return 'default';
}

function getDeploymentLabel(status?: string): string {
  switch (status) {
    case 'ACTIVE': return 'Active Running';
    case 'PROVISIONING': return 'Provisioning Node';
    case 'PENDING': return 'Pending Provision';
    case 'SUSPENDED': return 'Suspended';
    case 'FAILED': return 'Provision Failed';
    default: return 'Not Provisioned';
  }
}

function getDeploymentStatusBadge(status?: string): 'active' | 'pending' | 'suspended' | 'default' {
  if (status === 'ACTIVE') return 'active';
  if (['PROVISIONING', 'PENDING'].includes(status || '')) return 'pending';
  if (['SUSPENDED', 'FAILED'].includes(status || '')) return 'suspended';
  return 'default';
}

function StageActions({ stage, applicationId, rejectionReason, version }: {
  stage: OnboardingStage;
  applicationId?: string;
  rejectionReason?: string;
  version?: number;
}) {
  switch (stage) {
    case 'APPLICATION_REQUIRED':
      return (
        <div className="card border-[var(--accent)]/30 bg-[var(--surface)] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Submit Managed Hosting Application
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Provide your workload specs and project description to apply for a dedicated LioranDB cluster.
            </p>
          </div>
          <Link href="/application" className="btn-primary text-xs inline-flex items-center gap-1.5">
            <span>Start Application Form</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );

    case 'APPLICATION_PENDING':
      return (
        <div className="card border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Application Under Review</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Your application (version #{version || 1}) has been submitted and is currently being verified by the LioranDB engineering and support team.
          </p>
          <div className="pt-2">
            <Link href="/application" className="btn-secondary text-xs inline-flex items-center gap-1.5">
              <FileEdit className="w-3.5 h-3.5" />
              <span>Update / Edit Application Form</span>
            </Link>
          </div>
        </div>
      );

    case 'APPLICATION_APPROVED':
      return (
        <div className="card border-emerald-900/60 bg-[#0C1F14] p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Application Approved</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Your application has passed review. Please review and accept the Master Services Agreement &amp; Acceptable Use Policy to proceed to node provisioning.
          </p>
          <Link href="/onboarding/legal" className="btn-primary text-xs inline-flex items-center gap-1.5">
            <span>Review Agreements &amp; Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );

    case 'APPLICATION_REJECTED':
      return (
        <div className="card border-red-900/60 bg-[#160B0B] p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Application Not Approved</h2>
          </div>
          {rejectionReason && (
            <div className="alert-banner alert-banner-error text-xs">
              <strong>Review Team Feedback:</strong> {rejectionReason}
            </div>
          )}
          <p className="text-xs text-[var(--text-secondary)]">
            You can modify your project details or provide additional workload clarification and reapply.
          </p>
          <Link href="/application" className="btn-primary text-xs inline-flex items-center gap-1.5">
            <FileEdit className="w-3.5 h-3.5" />
            <span>Edit &amp; Reapply Application Form</span>
          </Link>
        </div>
      );

    case 'TERMS_REQUIRED':
      return (
        <div className="card border-[var(--accent)]/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Accept Legal Agreements
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Please sign the mandatory policies to trigger automatic provisioning of your dedicated cluster.
          </p>
          <Link href="/onboarding/legal" className="btn-primary text-xs inline-flex items-center gap-1.5">
            <span>Review &amp; Sign</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );

    case 'PROVISIONING':
      return (
        <div className="card p-5 space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Server className="w-4 h-4 animate-pulse" />
            <h2 className="text-sm font-semibold">Cluster Provisioning in Progress</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Your dedicated LioranDB node is being deployed and configured with TLS certs, firewall access, and credentials.
          </p>
        </div>
      );

    case 'SUSPENDED':
      return (
        <div className="card border-red-900/60 bg-[#160B0B] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-red-400">
            Cluster Service Suspended
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Your cluster access is temporarily suspended due to pending invoice verification or policy enforcement.
          </p>
          <Link href="/support" className="btn-danger text-xs inline-flex items-center gap-1.5">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Contact Developer Support</span>
          </Link>
        </div>
      );

    default:
      return null;
  }
}

