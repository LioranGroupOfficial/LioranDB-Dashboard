import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication } from '@/lib/db';
import { redirect } from 'next/navigation';
import ApplicationForm from '@/components/application/ApplicationForm';

export const metadata = { title: 'Managed Hosting Application & Form Settings' };

export default async function ApplicationPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  // Get last application for version tracking and pre-filling
  const lastApp = await HostingApplication.findOne({ userId: sessionUser.userId })
    .sort({ version: -1 })
    .lean();

  const nextVersion = (lastApp?.version || 0) + 1;

  const initialValues = lastApp
    ? {
        fullName: lastApp.fullName || user.profile?.fullName || '',
        workEmail: lastApp.workEmail || user.email,
        phone: lastApp.phone || user.profile?.phone || '',
        country: lastApp.country || user.profile?.country || '',
        companyName: lastApp.companyName || user.profile?.company || '',
        website: lastApp.website || '',
        description: lastApp.description || '',
        stage: lastApp.stage || '',
        githubUrl: lastApp.githubUrl || '',
        linkedinUrl: lastApp.linkedinUrl || '',
        twitterUrl: lastApp.twitterUrl || '',
        productUrl: lastApp.productUrl || '',
        demoUrl: lastApp.demoUrl || '',
        whyLioranDB: lastApp.whyLioranDB || '',
        appDescription: lastApp.appDescription || '',
        expectedDocumentCount: lastApp.expectedDocumentCount || '',
        expectedMonthlyUsers: lastApp.expectedMonthlyUsers || '',
        readTrafficLevel: lastApp.readTrafficLevel || '',
        writeTrafficLevel: lastApp.writeTrafficLevel || '',
        estimatedStorage: lastApp.estimatedStorage || '',
        isProduction: lastApp.isProduction ? 'true' : 'false',
        pricingResponse: lastApp.pricingResponse || 'yes',
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {lastApp ? 'Edit & Reapply Hosting Application' : 'Apply for LioranDB Managed Hosting'}
        </h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {lastApp
            ? `Update your project details (Application version #${nextVersion}). Your previously entered information has been loaded.`
            : 'Tell us about your project, workload characteristics, and deployment requirements.'}
        </p>
      </div>

      <ApplicationForm
        defaultEmail={user.email}
        defaultName={user.profile?.fullName}
        nextVersion={nextVersion}
        initialValues={initialValues}
      />
    </div>
  );
}

