import { NextRequest } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment, Subscription, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { clearSession } from '@/lib/auth/session';
import { createApiError } from '@/lib/errors';

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUser();

    await connectToDatabase();

    // Check for any pending or submitted unpaid payments
    const pendingPayments = await Payment.find({
      userId: sessionUser.userId,
      status: { $in: ['PENDING', 'SUBMITTED'] },
    }).lean();

    if (pendingPayments.length > 0) {
      const pendingAmount = pendingPayments.reduce((acc, p) => acc + p.amount, 0);
      return Response.json(
        {
          error: `Account deletion blocked: You have ${pendingPayments.length} unpaid / pending invoice(s) totaling ₹${pendingAmount.toLocaleString('en-IN')}. Please settle all outstanding payments before deleting your account.`,
          unpaidCount: pendingPayments.length,
          unpaidAmount: pendingAmount,
        },
        { status: 400 }
      );
    }

    // Terminate associated managed databases and active subscriptions
    await ManagedDatabase.updateMany(
      { userId: sessionUser.userId },
      { status: 'TERMINATED', state: 'STOPPED' }
    );

    await Subscription.updateMany(
      { userId: sessionUser.userId },
      { status: 'CANCELLED' }
    );

    // Deactivate user record
    await User.findByIdAndUpdate(sessionUser.userId, {
      isActive: false,
      onboardingStage: 'SUSPENDED',
    });

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'ACCOUNT_DELETED',
      entityType: 'User',
      entityId: sessionUser.userId,
      metadata: { email: sessionUser.email },
    });

    await clearSession();

    return Response.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    return createApiError(error);
  }
}

