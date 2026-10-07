import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { getCustomerMonthEstimate } from '@/lib/billing';

export async function GET(_req: NextRequest) {
  try {
    const session = await requireUserAPI();
    const estimate = await getCustomerMonthEstimate(session.userId);

    return NextResponse.json({
      success: true,
      estimate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch billing estimate';
    const status = message.includes('Unauthorized') || message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
