import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';
import { createApiError } from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAccountVerifiedUserAPI();
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
    return createApiError(error);
  }
}

