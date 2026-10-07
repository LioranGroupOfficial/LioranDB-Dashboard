import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { processMonthlyBillingInvoices } from '@/lib/billing/renewal';

export async function POST(_req: NextRequest) {
  try {
    await requireAdminAPI();
    const result = await processMonthlyBillingInvoices();

    return NextResponse.json({
      success: true,
      result,
      message: `Generated ${result.invoicesGenerated} invoices, marked ${result.overdueInvoicesCount} overdue.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Batch invoice generation failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
