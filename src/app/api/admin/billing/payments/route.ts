import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, Payment, Subscription } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { getNextBillingDate } from '@/lib/billing';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const RecordPaymentSchema = z.object({
  subscriptionId: z.string(),
  userId: z.string(),
  amount: z.number().min(1),
  currency: z.string().default('INR'),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
  advanceNextDue: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const body = await req.json();
    const parsed = RecordPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const {
      subscriptionId,
      userId,
      amount,
      currency,
      transactionReference,
      notes,
      advanceNextDue,
    } = parsed.data;

    await connectToDatabase();

    const now = new Date();
    const payment = await Payment.create({
      subscriptionId,
      userId,
      amount,
      currency,
      status: 'PAID',
      paidAt: now,
      transactionReference,
      notes,
      recordedBy: adminUser.userId,
    });

    if (advanceNextDue) {
      const nextDate = getNextBillingDate(now);
      await Subscription.findByIdAndUpdate(subscriptionId, {
        status: 'ACTIVE',
        nextPaymentDate: nextDate,
      });
    }

    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'admin',
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      metadata: { subscriptionId, amount, currency, transactionReference },
    });

    return Response.json({ success: true, paymentId: payment._id.toString() });
  } catch (error) {
    return createApiError(error);
  }
}

