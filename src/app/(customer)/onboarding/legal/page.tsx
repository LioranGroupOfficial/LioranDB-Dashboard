import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, PolicyDocument, PolicyAcceptance } from '@/lib/db';
import { redirect } from 'next/navigation';
import LegalAcceptanceForm from '@/components/onboarding/LegalAcceptanceForm';
import type { IPolicyDocument } from '@/lib/db/models/PolicyDocument';

export const metadata = { title: 'Accept Agreements' };

const REQUIRED_POLICIES = [
  'managed-hosting-terms',
  'privacy-policy',
  'acceptable-use-policy',
  'refund-cancellation-policy',
];

export default async function LegalPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

  const allowedStages = ['APPLICATION_APPROVED', 'TERMS_REQUIRED'];
  if (!allowedStages.includes(user.onboardingStage)) {
    redirect('/dashboard');
  }

  // Fetch active policy documents
  const policies = await PolicyDocument.find({
    slug: { $in: REQUIRED_POLICIES },
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
  ).filter(Boolean);

  const allAccepted = ordered.every((p) => p?.accepted);

  if (allAccepted) {
    // Already accepted all — move to provisioning
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Review Agreements</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Please read and accept the following agreements to continue your onboarding.
          Do not proceed unless you have read and understood each agreement.
        </p>
      </div>

      <LegalAcceptanceForm policies={ordered as NonNullable<typeof ordered[number]>[]} />
    </div>
  );
}
