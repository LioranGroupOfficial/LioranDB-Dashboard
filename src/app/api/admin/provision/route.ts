import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Subscription } from '@/lib/db';
import { generateDatabasePassword, encrypt } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, databaseProvisionedTemplate } from '@/lib/email';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { getNextBillingDate } from '@/lib/billing';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const ProvisionSchema = z.object({
  customerId: z.string(),
  name: z.string().min(2),
  host: z.string().min(3),
  port: z.number().default(27017),
  databaseName: z.string().min(2),
  username: z.string().min(2),
  temporaryPassword: z.string().optional(),
  expiresInDays: z.number().default(7),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const body = await req.json();
    const parsed = ProvisionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const {
      customerId,
      name,
      host,
      port,
      databaseName,
      username,
      temporaryPassword,
      expiresInDays,
    } = parsed.data;

    await connectToDatabase();

    const customer = await User.findById(customerId);
    if (!customer) {
      return Response.json({ error: 'Customer not found.' }, { status: 404 });
    }

    // Generate credentials
    const finalPassword = temporaryPassword || generateDatabasePassword(24);
    const connectionUri = `lioran://${username}:${finalPassword}@${host}:${port}/${databaseName}?ssl=true`;
    const encryptedConnectionUri = encrypt(connectionUri);

    // Call provisioning provider abstraction
    const provResult = await provisioningProvider.createDeployment({
      customerId,
      customerEmail: customer.email,
      deploymentName: name,
      username,
      password: finalPassword,
      host,
      port,
      databaseName,
      planId: 'managed-v1',
    });

    if (!provResult.success) {
      return Response.json({ error: provResult.error || 'Provider deployment failed.' }, { status: 500 });
    }

    const tempExpires = new Date();
    tempExpires.setDate(tempExpires.getDate() + expiresInDays);

    // Create Subscription first if none exists
    let subscription = await Subscription.findOne({ userId: customerId });
    if (!subscription) {
      const now = new Date();
      subscription = await Subscription.create({
        userId: customerId,
        planId: 'managed-v1',
        planName: 'LioranDB Managed Hosting',
        amount: 5000,
        currency: 'INR',
        status: 'ACTIVE',
        startedAt: now,
        currentPeriodStart: now,
        nextPaymentDate: getNextBillingDate(now),
      });
    }

    // Create ManagedDatabase record
    const database = await ManagedDatabase.create({
      customerId,
      name,
      username,
      encryptedConnectionUri,
      host,
      port,
      databaseName,
      status: 'ACTIVE',
      planId: 'managed-v1',
      subscriptionId: subscription._id,
      provisionedAt: new Date(),
      temporaryCredentialExpiresAt: tempExpires,
      passwordChangeRequired: true,
      providerDeploymentId: provResult.providerDeploymentId,
    });

    // Link DB to subscription
    await Subscription.findByIdAndUpdate(subscription._id, { databaseId: database._id });

    // Move customer to ACTIVE stage
    await User.findByIdAndUpdate(customerId, {
      onboardingStage: 'ACTIVE',
    });

    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'admin',
      action: 'DATABASE_PROVISIONED',
      entityType: 'ManagedDatabase',
      entityId: database._id.toString(),
      metadata: { customerEmail: customer.email, host, databaseName },
    });

    await createNotification({
      userId: customerId,
      type: 'DATABASE_READY',
      title: 'Managed database is ready',
      body: `Your database ${name} has been provisioned. Access your connection details in the dashboard.`,
      link: '/database',
    });

    await sendEmail({
      to: customer.email,
      subject: 'Your LioranDB managed database is ready',
      html: databaseProvisionedTemplate(
        customer.profile?.fullName || customer.email,
        databaseName,
        `${host}:${port}`
      ),
    });

    return Response.json({ success: true, databaseId: database._id.toString() });
  } catch (error) {
    return createApiError(error);
  }
}

