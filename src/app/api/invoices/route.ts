import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Invoice } from '@/lib/db';
import { createApiError } from '@/lib/errors';

export async function GET(_req: NextRequest) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    await connectToDatabase();

    const invoices = await Invoice.find({ customerId: session.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

