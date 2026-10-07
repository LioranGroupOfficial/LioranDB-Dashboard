import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, PolicyDocument, PolicyAcceptance } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, termsCompletedTemplate } from '@/lib/email';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0];
    const userAgent = req.headers.get('user-agent') || undefined;

    await connectToDatabase();

    const user = await User.findById(sessionUser.userId);
    if (!user) return Response.json({ error: 'User not found.' }, { status: 404 });

    const body = await req.json();
    const { policyIds } = body as { policyIds: string[] };

    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return Response.json({ error: 'Policy IDs are required.' }, { status: 400 });
    }

    // Validate all policy IDs exist and are active
    const policies = await PolicyDocument.find({
      _id: { $in: policyIds },
      active: true,
    });

    if (policies.length !== policyIds.length) {
      return Response.json(
        { error: 'One or more policies are invalid or no longer active.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Create immutable acceptance records
    await Promise.all(
      policies.map((policy) =>
        PolicyAcceptance.create({
          userId: user._id,
          policyId: policy._id,
          policySlug: policy.slug,
          policyVersion: policy.version,
          acceptedAt: now,
          ip: ip || undefined,
          userAgent,
        })
      )
    );

    // Audit log each acceptance
    await Promise.all(
      policies.map((policy) =>
        createAuditLog({
          userId: user._id.toString(),
          action: 'POLICY_ACCEPTED',
          entityType: 'POLICY',
          entityId: policy._id.toString(),
          metadata: {
            slug: policy.slug,
            version: policy.version,
          },
          ip: ip || undefined,
          userAgent,
        })
      )
    );

    await createNotification({
      userId: user._id.toString(),
      type: 'TERMS_REQUIRED',
      title: 'Agreements accepted',
      body: 'You have accepted the required service agreements.',
      link: '/dashboard',
    });

    await sendEmail({
      to: user.email,
      subject: 'Agreements accepted — LioranDB',
      html: termsCompletedTemplate(user.profile?.fullName || user.email),
    });

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}
