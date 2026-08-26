import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication, ManagedDatabase, Subscription } from '@/lib/db';
import Link from 'next/link';
import StatusTimeline from '@/components/dashboard/StatusTimeline';
import type { OnboardingStage } from '@/lib/db/models/User';

export const metadata = { title: 'Overview' };

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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {user?.profile?.fullName ? `Welcome, ${user.profile.fullName.split(' ')[0]}` : 'Overview'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          LioranDB Managed Hosting
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Account"
          value="Active"
          status="active"
          detail={sessionUser.email}
        />
        <StatusCard
          label="Application"
          value={getApplicationLabel(stage, latestApp?.status)}
          status={getApplicationStatus(stage)}
          detail={
            latestApp?.submittedAt
              ? `Submitted ${new Date(latestApp.submittedAt).toLocaleDateString('en-IN')}`
              : undefined
          }
        />
        <StatusCard
          label="Deployment"
          value={getDeploymentLabel(database?.status)}
          status={getDeploymentStatusBadge(database?.status)}
          detail={database?.name || undefined}
        />
      </div>

      {/* Onboarding Timeline */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Onboarding Progress
        </h2>
        <StatusTimeline stage={stage as OnboardingStage} rejectionReason={latestApp?.rejectionReason} />
      </div>

      {/* Stage-specific Actions */}
      <StageActions
        stage={stage as OnboardingStage}
        applicationId={latestApp?._id?.toString()}
        rejectionReason={latestApp?.rejectionReason}
      />

      {/* Subscription info if active */}
      {subscription && stage === 'ACTIVE' && (
        <div className="card">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
            Subscription
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Plan</p>
              <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">
                {subscription.planName}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Monthly</p>
              <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">
                ₹5,000/month
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Status</p>
              <span className={`badge badge-${subscription.status === 'ACTIVE' ? 'active' : 'pending'} mt-0.5`}>
                {subscription.status}
              </span>
            </div>
            {subscription.nextPaymentDate && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">Next payment</p>
                <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">
                  {new Date(subscription.nextPaymentDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
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
  detail,
}: {
  label: string;
  value: string;
  status: 'active' | 'pending' | 'suspended' | 'default';
  detail?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`badge badge-${status}`}>{value}</span>
      </div>
      {detail && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 truncate">{detail}</p>
      )}
    </div>
  );
}

function getApplicationLabel(stage: string, appStatus?: string): string {
  switch (stage) {
    case 'APPLICATION_REQUIRED': return 'Not submitted';
    case 'APPLICATION_PENDING': return 'Submitted';
    case 'APPLICATION_APPROVED': return 'Approved';
    case 'APPLICATION_REJECTED': return 'Not approved';
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
    case 'ACTIVE': return 'Active';
    case 'PROVISIONING': return 'Provisioning';
    case 'PENDING': return 'Pending';
    case 'SUSPENDED': return 'Suspended';
    case 'FAILED': return 'Failed';
    default: return 'Not provisioned';
  }
}

function getDeploymentStatusBadge(status?: string): 'active' | 'pending' | 'suspended' | 'default' {
  if (status === 'ACTIVE') return 'active';
  if (['PROVISIONING', 'PENDING'].includes(status || '')) return 'pending';
  if (['SUSPENDED', 'FAILED'].includes(status || '')) return 'suspended';
  return 'default';
}

function StageActions({ stage, applicationId, rejectionReason }: {
  stage: OnboardingStage;
  applicationId?: string;
  rejectionReason?: string;
}) {
  switch (stage) {
    case 'APPLICATION_REQUIRED':
      return (
        <div className="card border-[var(--accent)]/30">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Apply for Managed Hosting
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Submit your managed hosting application to get started with LioranDB.
          </p>
          <Link href="/application" className="btn-primary inline-flex">
            Start Application
          </Link>
        </div>
      );

    case 'APPLICATION_PENDING':
      return (
        <div className="card">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Application under review
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            We&apos;ve received your managed hosting application. You&apos;ll see the decision here once the review is complete.
          </p>
        </div>
      );

    case 'APPLICATION_APPROVED':
      return (
        <div className="card">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Application approved
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Your application has been approved. Review and accept the required agreements to continue onboarding.
          </p>
          <Link href="/onboarding/legal" className="btn-primary inline-flex">
            Continue →
          </Link>
        </div>
      );

    case 'APPLICATION_REJECTED':
      return (
        <div className="card">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Application not approved
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            We couldn&apos;t approve this application at this time.
          </p>
          {rejectionReason && (
            <div className="alert-banner alert-banner-error text-sm mb-4">
              <strong>Reason from the review team:</strong> {rejectionReason}
            </div>
          )}
          <Link href="/application" className="btn-secondary inline-flex">
            Submit New Application
          </Link>
        </div>
      );

    case 'TERMS_REQUIRED':
      return (
        <div className="card">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Accept agreements
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Please review and accept the required agreements to activate your managed hosting.
          </p>
          <Link href="/onboarding/legal" className="btn-primary inline-flex">
            Review &amp; Accept
          </Link>
        </div>
      );

    case 'PROVISIONING':
      return (
        <div className="card">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">
            Provisioning in progress
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Your managed LioranDB deployment is being prepared. This page will update when it&apos;s ready.
          </p>
        </div>
      );

    case 'SUSPENDED':
      return (
        <div className="card border-red-500/30">
          <h2 className="text-base font-medium text-red-400 mb-2">
            Service suspended
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Your managed hosting service has been suspended. Contact support to resolve this.
          </p>
          <Link href="/support" className="btn-primary inline-flex">
            Contact Support
          </Link>
        </div>
      );

    default:
      return null;
  }
}
