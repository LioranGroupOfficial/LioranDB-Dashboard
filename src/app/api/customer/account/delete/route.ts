import { NextRequest } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/guards';
import {
  connectToDatabase,
  User,
  Payment,
  Subscription,
  ManagedDatabase,
  HostingApplication,
  PolicyAcceptance,
  SupportTicket,
  TicketMessage,
  Notification,
  EmailVerification,
  PasswordReset,
} from '@/lib/db';
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

    // 1. Audit log the deletion before removing records
    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'ACCOUNT_DELETED',
      entityType: 'User',
      entityId: sessionUser.userId,
      metadata: {
        email: sessionUser.email,
        reason: 'User requested permanent account deletion',
      },
    });

    // 2. Cascade delete all support tickets and messages
    const userTickets = await SupportTicket.find({ userId: sessionUser.userId }).select('_id').lean();
    const ticketIds = userTickets.map((t) => t._id);
    if (ticketIds.length > 0) {
      await TicketMessage.deleteMany({ ticketId: { $in: ticketIds } });
    }
    await SupportTicket.deleteMany({ userId: sessionUser.userId });

    // 3. Delete managed database records
    await ManagedDatabase.deleteMany({
      $or: [{ userId: sessionUser.userId }, { customerId: sessionUser.userId }],
    });

    // 4. Delete subscriptions, applications, and payments
    await Subscription.deleteMany({ userId: sessionUser.userId });
    await HostingApplication.deleteMany({ userId: sessionUser.userId });
    await Payment.deleteMany({ userId: sessionUser.userId });

    // 5. Delete legal agreements and policy acceptances
    await PolicyAcceptance.deleteMany({ userId: sessionUser.userId });

    // 6. Delete notifications, email verifications, and password reset tokens
    await Notification.deleteMany({ userId: sessionUser.userId });
    await EmailVerification.deleteMany({ userId: sessionUser.userId });
    await PasswordReset.deleteMany({ userId: sessionUser.userId });

    // 7. Permanently delete the User document from the database
    await User.findByIdAndDelete(sessionUser.userId);

    // 8. Destroy active session cookie
    await clearSession();

    return Response.json({
      success: true,
      message: 'Account and associated data have been permanently removed from the database.',
    });
  } catch (error) {
    return createApiError(error);
  }
}
