import { NextRequest } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, Payment, Subscription, User } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const CreateInvoiceSchema = z.object({
  userId: z.string(),
  subscriptionId: z.string().optional(),
  amount: z.number().min(1),
  currency: z.string().default('INR'),
  billingMonth: z.string().min(1, 'Billing month is required'),
  dueDate: z.string().optional(),
  razorpayPaymentLink: z.string().url('Must be a valid Razorpay payment URL'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireRoleAPI('admin');
    const body = await req.json();
    const parsed = CreateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const {
      userId,
      subscriptionId,
      amount,
      currency,
      billingMonth,
      dueDate,
      razorpayPaymentLink,
      notes,
    } = parsed.data;

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return Response.json({ error: 'Customer not found.' }, { status: 404 });
    }

    let subId = subscriptionId;
    if (!subId) {
      const activeSub = await Subscription.findOne({ userId, status: { $in: ['ACTIVE', 'SUSPENDED'] } });
      if (activeSub) {
        subId = activeSub._id.toString();
      }
    }

    const payment = await Payment.create({
      userId,
      subscriptionId: subId,
      amount,
      currency,
      status: 'PENDING',
      billingMonth,
      razorpayPaymentLink,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes,
      recordedBy: adminUser.userId,
    });

    await createNotification({
      userId,
      type: 'PAYMENT_DUE',
      title: `Invoice generated for ${billingMonth}`,
      body: `Your monthly hosting invoice of ₹${amount.toLocaleString('en-IN')} is ready. Please complete payment via the attached Razorpay link.`,
      link: '/billing',
    });

    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'admin',
      action: 'INVOICE_CREATED',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      metadata: { userId, amount, currency, billingMonth, razorpayPaymentLink },
    });

    return Response.json({ success: true, paymentId: payment._id.toString() });
  } catch (error) {
    return createApiError(error);
  }
}

