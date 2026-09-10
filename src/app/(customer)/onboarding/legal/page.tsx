import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, HostingApplication, PolicyDocument, PolicyAcceptance } from '@/lib/db';
import { redirect } from 'next/navigation';
import LegalAcceptanceForm from '@/components/onboarding/LegalAcceptanceForm';
import { REQUIRED_POLICIES, ensureDefaultPolicies } from '@/lib/policies';

export const metadata = { title: 'Accept Agreements' };

export default async function LegalPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const [user, latestApp] = await Promise.all([
    User.findById(sessionUser.userId).lean(),
    HostingApplication.findOne({ userId: sessionUser.userId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) redirect('/login');

  const isEligible =
    ['APPLICATION_APPROVED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'].includes(user.onboardingStage) ||
    latestApp?.status === 'APPROVED';

  if (!isEligible) {
    redirect('/dashboard');
  }

  // Auto-sync onboarding stage if application was approved but stage was out of sync
  if (latestApp?.status === 'APPROVED' && ['APPLICATION_PENDING', 'APPLICATION_REQUIRED'].includes(user.onboardingStage)) {
    await User.findByIdAndUpdate(user._id, { onboardingStage: 'APPLICATION_APPROVED' });
  }

  // Ensure default legal policy documents exist in the database
  await ensureDefaultPolicies();

  // Fetch active policy documents
  const policies = await PolicyDocument.find({
    slug: { $in: REQUIRED_POLICIES as unknown as string[] },
    active: true,
  }).lean();

  // Check which policies user has already accepted (with current version)
  const acceptances = await PolicyAcceptance.find({
    userId: user._id,
    policySlug: { $in: policies.map((p) => p.slug) },
    policyVersion: {
      $in: policies.map((p) => p.version),
    },
  }).lean();

  const acceptedSlugs = new Set(acceptances.map((a) => `${a.policySlug}:${a.policyVersion}`));

  const policiesWithState = policies.map((p) => ({
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    version: p.version,
    content: p.content,
    accepted: acceptedSlugs.has(`${p.slug}:${p.version}`),
  }));

  // Sort in required order
  const ordered = REQUIRED_POLICIES.map((slug) =>
    policiesWithState.find((p) => p.slug === slug)
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const allAccepted =
    ordered.length === REQUIRED_POLICIES.length && ordered.every((p) => p.accepted);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Review Agreements</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Please read and accept the following agreements to continue your onboarding.
          Do not proceed unless you have read and understood each agreement.
        </p>
      </div>

      <LegalAcceptanceForm policies={ordered} allPreviouslyAccepted={allAccepted} />
    </div>
  );
}
