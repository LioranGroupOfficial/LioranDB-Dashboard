import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, Payment, Subscription, User } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getNextBillingDate } from '@/lib/billing';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const VerifyPaymentSchema = z.object({
  paymentId: z.string(),
  decision: z.enum(['VERIFIED', 'REJECTED']),
  transactionReference: z.string().optional(),
  verificationNotes: z.string().optional(),
  advanceSubscription: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const body = await req.json();
    const parsed = VerifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const {
      paymentId,
      decision,
      transactionReference,
      verificationNotes,
      advanceSubscription,
    } = parsed.data;

    await connectToDatabase();

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return Response.json({ error: 'Payment record not found.' }, { status: 404 });
    }

    const now = new Date();

    if (decision === 'VERIFIED') {
      payment.status = 'PAID';
      payment.paidAt = now;
      payment.verifiedAt = now;
      payment.verifiedBy = adminUser.userId as unknown as import('mongoose').Types.ObjectId;
      if (transactionReference) payment.transactionReference = transactionReference;
      if (verificationNotes) payment.verificationNotes = verificationNotes;
      await payment.save();

      if (payment.subscriptionId && advanceSubscription) {
        const nextDate = getNextBillingDate(now);
        await Subscription.findByIdAndUpdate(payment.subscriptionId, {
          status: 'ACTIVE',
          nextPaymentDate: nextDate,
        });
      }

      await createNotification({
        userId: payment.userId.toString(),
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Verified & Confirmed',
        body: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.billingMonth || 'hosting'} has been verified by the LioranDB admin.`,
        link: '/billing',
      });

      await createAuditLog({
        actorId: adminUser.userId,
        actorRole: 'admin',
        action: 'PAYMENT_VERIFIED',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { status: 'PAID', transactionReference, verificationNotes },
      });
    } else {
      payment.status = 'FAILED';
      payment.verificationNotes = verificationNotes || 'Transaction verification unsuccessful.';
      await payment.save();

      await createNotification({
        userId: payment.userId.toString(),
        type: 'PAYMENT_DUE',
        title: 'Payment Verification Unsuccessful',
        body: `Your submitted payment details could not be verified: ${verificationNotes || 'Invalid transaction reference'}. Please review and resubmit.`,
        link: '/billing',
      });

      await createAuditLog({
        actorId: adminUser.userId,
        actorRole: 'admin',
        action: 'PAYMENT_VERIFICATION_REJECTED',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { status: 'FAILED', verificationNotes },
      });
    }

    return Response.json({ success: true, status: payment.status });
  } catch (error) {
    return createApiError(error);
  }
}

