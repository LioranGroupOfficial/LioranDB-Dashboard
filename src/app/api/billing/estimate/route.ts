import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { getCustomerMonthEstimate } from '@/lib/billing';
import { createApiError } from '@/lib/errors';

export async function GET(_req: NextRequest) {
  try {
    const session = await requireAccountVerifiedUserAPI();
    const estimate = await getCustomerMonthEstimate(session.userId);

    return NextResponse.json({
      success: true,
      estimate,
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

