import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { processMonthlyBillingInvoices } from '@/lib/billing/renewal';
import { formatPaiseToRupees } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    await requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const result = await processMonthlyBillingInvoices(body);

    const amountStr = formatPaiseToRupees(result.totalAmountPaise);
    return NextResponse.json({
      success: true,
      result,
      message: `Generated ${result.invoicesGenerated} invoices (${amountStr}), marked ${result.overdueInvoicesCount} overdue.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Batch invoice generation failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
