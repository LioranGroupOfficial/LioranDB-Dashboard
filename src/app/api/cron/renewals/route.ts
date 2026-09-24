import { NextRequest, NextResponse } from 'next/server';
import { processSubscriptionRenewals } from '@/lib/billing/renewal';

export async function POST(req: NextRequest) {
  try {
    // Basic auth or internal bearer check can be added here
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET;

    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      // If header provided, validate
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processSubscriptionRenewals();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Renewals processing failed';
    console.error('[Renewals Cron Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

