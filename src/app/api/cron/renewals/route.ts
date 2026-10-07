import { NextRequest, NextResponse } from 'next/server';
import { processMonthlyBillingInvoices } from '@/lib/billing/renewal';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET;

    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processMonthlyBillingInvoices();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Monthly billing processing failed';
    console.error('[Monthly Billing Cron Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
