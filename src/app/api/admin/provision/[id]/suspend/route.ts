import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, User, Subscription } from '@/lib/db';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, suspensionTemplate } from '@/lib/email';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const SuspendSchema = z.object({
  reason: z.string().min(3),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const { id } = await params;
    const body = await req.json();
    const parsed = SuspendSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { reason } = parsed.data;

    await connectToDatabase();
    const db = await ManagedDatabase.findById(id);
    if (!db) return Response.json({ error: 'Database not found.' }, { status: 404 });

    const customer = await User.findById(db.customerId);

    // Call provider
    if (db.providerDeploymentId) {
      await provisioningProvider.suspendDeployment(db.providerDeploymentId, reason);
    }

    const now = new Date();
    await ManagedDatabase.findByIdAndUpdate(id, {
      status: 'SUSPENDED',
      suspendedAt: now,
      suspensionReason: reason,
    });

    if (customer) {
      await User.findByIdAndUpdate(customer._id, { onboardingStage: 'SUSPENDED' });
      await Subscription.updateMany({ userId: customer._id }, { status: 'SUSPENDED', suspendedAt: now, suspensionReason: reason });

      await createNotification({
        userId: customer._id.toString(),
        type: 'SERVICE_SUSPENDED',
        title: 'Service suspended',
        body: `Your managed hosting service has been suspended: ${reason}`,
        link: '/support',
      });

      await sendEmail({
        to: customer.email,
        subject: 'LioranDB Managed Hosting — Service Suspended',
        html: suspensionTemplate(customer.profile?.fullName || customer.email, reason),
      });
    }

    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'admin',
      action: 'DATABASE_SUSPENDED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: { reason, customerEmail: customer?.email },
    });

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

