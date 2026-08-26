import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { ApplicationSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { connectToDatabase, User, HostingApplication } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import {
  sendEmail,
  applicationReceivedTemplate,
} from '@/lib/email';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();

    await connectToDatabase();

    // Verify user is in the right onboarding stage
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!['APPLICATION_REQUIRED', 'APPLICATION_REJECTED'].includes(user.onboardingStage)) {
      return Response.json(
        { error: 'You cannot submit a new application at this time.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = ApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;

    // Get next version number
    const lastApp = await HostingApplication.findOne({ userId: user._id }).sort({ version: -1 });
    const version = (lastApp?.version || 0) + 1;

    // Create application
    const application = await HostingApplication.create({
      userId: user._id,
      version,
      ...data,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    // Update user onboarding stage
    await User.findByIdAndUpdate(user._id, {
      onboardingStage: 'APPLICATION_PENDING',
      'profile.fullName': data.fullName,
      'profile.company': data.companyName,
      'profile.country': data.country,
    });

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'APPLICATION_SUBMITTED',
      entityType: 'HostingApplication',
      entityId: application._id.toString(),
      metadata: { version, companyName: data.companyName },
    });

    await createNotification({
      userId: user._id.toString(),
      type: 'APPLICATION_SUBMITTED',
      title: 'Application submitted',
      body: 'Your managed hosting application has been received and is under review.',
      link: '/dashboard',
    });

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Application received — LioranDB Managed Hosting',
      html: applicationReceivedTemplate(data.fullName, application._id.toString()),
    });

    return Response.json({
      success: true,
      applicationId: application._id.toString(),
    });
  } catch (error) {
    return createApiError(error);
  }
}
