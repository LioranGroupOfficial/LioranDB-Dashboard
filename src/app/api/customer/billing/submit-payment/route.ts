import { NextRequest } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, Payment } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const SubmitPaymentSchema = z.object({
  paymentId: z.string(),
  submittedReference: z.string().min(3, 'Transaction reference / Razorpay payment ID is required'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUser();
    const body = await req.json();
    const parsed = SubmitPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { paymentId, submittedReference, notes } = parsed.data;

    await connectToDatabase();

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: sessionUser.userId,
    });

    if (!payment) {
      return Response.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    if (payment.status === 'PAID') {
      return Response.json({ error: 'This payment has already been verified and paid.' }, { status: 400 });
    }

    payment.submittedReference = submittedReference;
    payment.transactionReference = submittedReference;
    payment.submittedAt = new Date();
    payment.status = 'SUBMITTED';
    if (notes) payment.notes = notes;
    await payment.save();

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'PAYMENT_SUBMITTED_FOR_VERIFICATION',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: { submittedReference, amount: payment.amount },
    });

    return Response.json({ success: true, status: 'SUBMITTED' });
  } catch (error) {
    return createApiError(error);
  }
}

