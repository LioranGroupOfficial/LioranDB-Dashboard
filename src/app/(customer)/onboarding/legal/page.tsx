import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, PolicyDocument, PolicyAcceptance } from '@/lib/db';
import { redirect } from 'next/navigation';
import LegalAcceptanceForm from '@/components/onboarding/LegalAcceptanceForm';
import { REQUIRED_POLICIES, ensureDefaultPolicies } from '@/lib/policies';

export const metadata = { title: 'Accept Agreements' };

export default async function LegalPage() {
  const sessionUser = await requireVerifiedUser();

  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).lean();

  if (!user) redirect('/login');

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
        <h1 className="text-2xl font-normal font-serif text-[var(--text-primary)] tracking-tight">Review Agreements</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Please read and accept the following agreements to continue using the platform.
        </p>
      </div>

      <LegalAcceptanceForm policies={ordered} allPreviouslyAccepted={allAccepted} />
    </div>
  );
}
