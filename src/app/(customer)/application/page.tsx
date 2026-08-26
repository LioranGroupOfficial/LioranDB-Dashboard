import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication } from '@/lib/db';
import { redirect } from 'next/navigation';
import ApplicationForm from '@/components/application/ApplicationForm';

export const metadata = { title: 'Apply for Managed Hosting' };

export default async function ApplicationPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  // Check if user can apply
  const allowedStages = ['APPLICATION_REQUIRED', 'APPLICATION_REJECTED'];
  if (!allowedStages.includes(user.onboardingStage)) {
    redirect('/dashboard');
  }

  // Get last application for version tracking
  const lastApp = await HostingApplication.findOne({ userId: sessionUser.userId })
    .sort({ version: -1 })
    .lean();

  const nextVersion = (lastApp?.version || 0) + 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Apply for LioranDB Managed Hosting
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {nextVersion > 1
            ? `Application attempt #${nextVersion} — your previous application is preserved for reference.`
            : 'Tell us about your project and how you plan to use LioranDB.'}
        </p>
      </div>
      <ApplicationForm
        defaultEmail={user.email}
        defaultName={user.profile?.fullName}
        nextVersion={nextVersion}
      />
    </div>
  );
}
