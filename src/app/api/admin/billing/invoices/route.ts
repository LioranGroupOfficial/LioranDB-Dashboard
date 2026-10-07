import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, invoices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoices';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

