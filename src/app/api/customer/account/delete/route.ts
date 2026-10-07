import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/guards';
import {
  connectToDatabase,
  User,
  Payment,
  Subscription,
  ManagedDatabase,
  Invoice,
  BillingInterval,
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
import { formatPaiseToRupees } from '@/lib/plans';

export async function DELETE(_req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUser();

    await connectToDatabase();

    // Check for any unpaid OPEN or OVERDUE invoices
    const unpaidInvoices = await Invoice.find({
      customerId: sessionUser.userId,
      status: { $in: ['OPEN', 'OVERDUE'] },
    }).lean();

    if (unpaidInvoices.length > 0) {
      const unpaidPaise = unpaidInvoices.reduce((acc, inv) => acc + (inv.totalPaise || 0), 0);
      return NextResponse.json(
        {
          error: `Account deletion blocked: You have ${unpaidInvoices.length} unpaid invoice(s) totaling ${formatPaiseToRupees(
            unpaidPaise
          )}. Please settle all outstanding invoices before deleting your account.`,
          unpaidCount: unpaidInvoices.length,
          unpaidPaise,
        },
        { status: 400 }
      );
    }

    // 1. Audit log the deletion
    await createAuditLog({
      userId: sessionUser.userId,
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

    // 3. Delete managed database records and intervals
    await ManagedDatabase.deleteMany({
      $or: [{ userId: sessionUser.userId }, { customerId: sessionUser.userId }],
    });
    await BillingInterval.deleteMany({ customerId: sessionUser.userId });

    // 4. Delete subscriptions, invoices, and payments
    await Subscription.deleteMany({ userId: sessionUser.userId });
    await Invoice.deleteMany({ customerId: sessionUser.userId });
    await Payment.deleteMany({ userId: sessionUser.userId });

    // 5. Delete legal agreements and policy acceptances
    await PolicyAcceptance.deleteMany({ userId: sessionUser.userId });

    // 6. Delete notifications, email verifications, and password reset tokens
    await Notification.deleteMany({ userId: sessionUser.userId });
    await EmailVerification.deleteMany({ userId: sessionUser.userId });
    await PasswordReset.deleteMany({ userId: sessionUser.userId });

    // 7. Permanently delete the User document
    await User.findByIdAndDelete(sessionUser.userId);

    // 8. Destroy active session cookie
    await clearSession();

    return NextResponse.json({
      success: true,
      message: 'Account and associated data have been permanently removed from the database.',
    });
  } catch (error) {
    return createApiError(error);
  }
}
