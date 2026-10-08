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
import { getCustomerMonthEstimate } from '@/lib/billing';

export async function DELETE(_req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUser();

    await connectToDatabase();

    // 1. Check for active/running databases
    const activeDatabases = await ManagedDatabase.find({
      $or: [{ userId: sessionUser.userId }, { customerId: sessionUser.userId }],
      status: { $nin: ['TERMINATED', 'DELETED'] },
    }).lean();

    if (activeDatabases.length > 0) {
      const dbNames = activeDatabases.map((db) => db.name).join(', ');
      return NextResponse.json(
        {
          error: `Account deletion blocked: You have ${activeDatabases.length} active database instance(s) running (${dbNames}). You must terminate all databases before deleting your account.`,
          activeDatabasesCount: activeDatabases.length,
        },
        { status: 400 }
      );
    }

    // 2. Check for any unpaid OPEN or OVERDUE invoices
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

    // 3. Check for unbilled accrued usage
    const accruedEstimate = await getCustomerMonthEstimate(sessionUser.userId);
    if (accruedEstimate.totalEstimatedPaise > 0) {
      return NextResponse.json(
        {
          error: `Account deletion blocked: You have ${formatPaiseToRupees(
            accruedEstimate.totalEstimatedPaise
          )} in unbilled database runtime usage. Please settle all usage before deleting your account.`,
          unbilledAccruedPaise: accruedEstimate.totalEstimatedPaise,
        },
        { status: 400 }
      );
    }

    // 4. Check for pending payments in-flight
    const pendingPayments = await Payment.find({
      userId: sessionUser.userId,
      status: { $in: ['PENDING', 'SUBMITTED'] },
    }).lean();

    if (pendingPayments.length > 0) {
      return NextResponse.json(
        {
          error: `Account deletion blocked: You have ${pendingPayments.length} payment(s) currently being processed. Please wait for settlement before deleting your account.`,
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
