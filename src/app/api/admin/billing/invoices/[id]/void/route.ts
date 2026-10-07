import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Voided by administrator';

    await connectToDatabase();
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Cannot void a paid invoice' }, { status: 400 });
    }

    invoice.status = 'VOID';
    await invoice.save();

    await createAuditLog({
      userId: admin.userId,
      action: 'INVOICE_VOIDED',
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      metadata: { invoiceNumber: invoice.invoiceNumber, action: 'VOID', reason },
    });

    return NextResponse.json({ success: true, message: 'Invoice voided successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to void invoice';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
