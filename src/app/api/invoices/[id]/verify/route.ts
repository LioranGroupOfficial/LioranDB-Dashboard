import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice, Payment } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { formatPaiseToRupees } from '@/lib/plans';
import { createApiError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment signature parameters' }, { status: 400 });
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

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
      return NextResponse.json({ success: true, message: 'Invoice already paid' });
    }

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    invoice.paymentTransactionReference = razorpay_payment_id;
    await invoice.save();

    // Create payment record
    await Payment.create({
      userId: invoice.customerId,
      invoiceId: invoice._id,
      amount: invoice.totalPaise / 100,
      amountPaise: invoice.totalPaise,
      currency: invoice.currency || 'INR',
      status: 'PAID',
      type: 'invoice',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      razorpaySignatureVerified: true,
      paidAt: new Date(),
      transactionReference: razorpay_payment_id,
    });

    await createAuditLog({
      userId: session.userId,
      action: 'PAYMENT_CAPTURED',
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        amountPaise: invoice.totalPaise,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    await createNotification({
      userId: invoice.customerId.toString(),
      type: 'PAYMENT_RECEIVED',
      title: 'Invoice Paid Successfully',
      body: `Payment of ${formatPaiseToRupees(invoice.totalPaise)} for invoice ${invoice.invoiceNumber} has been received.`,
      link: '/billing',
    });

    if (invoice.customerEmail) {
      await sendEmail({
        to: invoice.customerEmail,
        subject: `Payment Receipt: ${invoice.invoiceNumber}`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Payment Receipt</h2>
          <p>Thank you! Your payment for invoice <strong>${invoice.invoiceNumber}</strong> has been processed successfully.</p>
          <p><strong>Amount Paid:</strong> ${formatPaiseToRupees(invoice.totalPaise)}</p>
          <p><strong>Transaction Ref:</strong> ${razorpay_payment_id}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
        </div>`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and invoice marked as paid',
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

