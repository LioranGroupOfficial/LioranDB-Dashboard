import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const query: Record<string, unknown> = { _id: id };
    if (session.role !== 'admin') {
      query.customerId = session.userId;
    }

    const invoice = await Invoice.findOne(query).lean();
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoice';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
