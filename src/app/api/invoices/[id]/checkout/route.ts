import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';
import { createRazorpayOrder } from '@/lib/razorpay';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (session.role !== 'admin') {
      if (invoice.customerId.toString() !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized access to invoice' }, { status: 403 });
      }
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    if (invoice.status === 'VOID') {
      return NextResponse.json({ error: 'Invoice is void and cannot be paid' }, { status: 400 });
    }

    if (invoice.totalPaise <= 0) {
      invoice.status = 'PAID';
      invoice.paidAt = new Date();
      await invoice.save();
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: 'Invoice marked as paid ($0 total)',
      });
    }

    const order = await createRazorpayOrder({
      amountPaise: invoice.totalPaise,
      currency: invoice.currency || 'INR',
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
