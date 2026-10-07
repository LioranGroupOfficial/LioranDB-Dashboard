import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice, Payment } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { formatPaiseToRupees } from '@/lib/plans';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reference = body.reference || `MANUAL-${Date.now()}`;

    await connectToDatabase();
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already marked as paid' }, { status: 400 });
    }

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    invoice.paymentTransactionReference = reference;
    await invoice.save();

    await Payment.create({
      userId: invoice.customerId,
      invoiceId: invoice._id,
      amount: invoice.totalPaise / 100,
      amountPaise: invoice.totalPaise,
      currency: invoice.currency || 'INR',
      status: 'PAID',
      type: 'invoice',
      paidAt: new Date(),
      transactionReference: reference,
    });

    await createAuditLog({
      userId: admin.userId,
      action: 'PAYMENT_CAPTURED',
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      metadata: { invoiceNumber: invoice.invoiceNumber, reference, manual: true },
    });

    await createNotification({
      userId: invoice.customerId.toString(),
      type: 'PAYMENT_RECEIVED',
      title: 'Invoice Marked as Paid',
      body: `Your invoice ${invoice.invoiceNumber} for ${formatPaiseToRupees(invoice.totalPaise)} has been marked as paid.`,
      link: '/billing',
    });

    return NextResponse.json({ success: true, message: 'Invoice marked as paid' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark invoice as paid';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
