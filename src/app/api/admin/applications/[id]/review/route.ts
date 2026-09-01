import { NextRequest } from 'next/server';
import { requireAnyRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, HostingApplication, User } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, applicationApprovedTemplate, applicationRejectedTemplate } from '@/lib/email';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const ReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'UNDER_REVIEW']),
  reviewNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const reviewerUser = await requireAnyRoleAPI(['admin', 'support']);
    const { id } = await params;
    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { status, reviewNotes, rejectionReason } = parsed.data;

    await connectToDatabase();
    const app = await HostingApplication.findById(id).populate('userId');
    if (!app) {
      return Response.json({ error: 'Application not found.' }, { status: 404 });
    }

    const user = app.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } };

    // Update application
    await HostingApplication.findByIdAndUpdate(id, {
      status,
      reviewNotes,
      rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
      reviewedAt: new Date(),
      reviewedBy: reviewerUser.userId,
    });

    // Update user onboarding stage
    if (status === 'APPROVED') {
      await User.findByIdAndUpdate(user._id, {
        onboardingStage: 'APPLICATION_APPROVED',
      });

      await createNotification({
        userId: user._id.toString(),
        type: 'APPLICATION_APPROVED',
        title: 'Application approved',
        body: 'Your LioranDB Managed Hosting application has been approved. Please review and accept the agreements.',
        link: '/onboarding/legal',
      });

      await sendEmail({
        to: user.email,
        subject: 'Your LioranDB application has been approved',
        html: applicationApprovedTemplate(user.profile?.fullName || user.email),
      });

      await createAuditLog({
        actorId: reviewerUser.userId,
        actorRole: reviewerUser.role,
        action: 'APPLICATION_APPROVED',
        entityType: 'HostingApplication',
        entityId: id,
        metadata: { applicantEmail: user.email },
      });
    } else if (status === 'REJECTED') {
      await User.findByIdAndUpdate(user._id, {
        onboardingStage: 'APPLICATION_REJECTED',
      });

      await createNotification({
        userId: user._id.toString(),
        type: 'APPLICATION_REJECTED',
        title: 'Application update',
        body: `Your application could not be approved. Reason: ${rejectionReason}`,
        link: '/dashboard',
      });

      await sendEmail({
        to: user.email,
        subject: 'Update on your LioranDB application',
        html: applicationRejectedTemplate(
          user.profile?.fullName || user.email,
          rejectionReason || 'Application criteria not met.'
        ),
      });

      await createAuditLog({
        actorId: reviewerUser.userId,
        actorRole: reviewerUser.role,
        action: 'APPLICATION_REJECTED',
        entityType: 'HostingApplication',
        entityId: id,
        metadata: { applicantEmail: user.email, rejectionReason },
      });
    } else {
      await createAuditLog({
        actorId: reviewerUser.userId,
        actorRole: reviewerUser.role,
        action: 'APPLICATION_REVIEWED',
        entityType: 'HostingApplication',
        entityId: id,
        metadata: { status: 'UNDER_REVIEW' },
      });
    }

    return Response.json({ success: true, status });
  } catch (error) {
    return createApiError(error);
  }
}

