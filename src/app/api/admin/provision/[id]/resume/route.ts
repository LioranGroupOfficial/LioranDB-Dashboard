import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, User, Subscription } from '@/lib/db';
import { provisioningProvider } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const { id } = await params;

    await connectToDatabase();
    const db = await ManagedDatabase.findById(id);
    if (!db) return Response.json({ error: 'Database not found.' }, { status: 404 });

    const customer = await User.findById(db.customerId);

    // Call provider
    if (db.providerDeploymentId) {
      await provisioningProvider.resumeDeployment(db.providerDeploymentId);
    }

    await ManagedDatabase.findByIdAndUpdate(id, {
      status: 'ACTIVE',
      suspendedAt: undefined,
      suspensionReason: undefined,
    });

    if (customer) {
      await User.findByIdAndUpdate(customer._id, { onboardingStage: 'ACTIVE' });
      await Subscription.updateMany(
        { userId: customer._id, status: 'SUSPENDED' },
        { status: 'ACTIVE', suspendedAt: undefined, suspensionReason: undefined }
      );

      await createNotification({
        userId: customer._id.toString(),
        type: 'SERVICE_RESUMED',
        title: 'Service resumed',
        body: 'Your managed database service has been resumed and is active.',
        link: '/database',
      });
    }

    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'admin',
      action: 'DATABASE_RESUMED',
      entityType: 'ManagedDatabase',
      entityId: id,
      metadata: { customerEmail: customer?.email },
    });

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

