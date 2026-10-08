import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { processMonthlyBillingInvoices } from '@/lib/billing/renewal';
import { formatPaiseToRupees } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    await requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const result = await processMonthlyBillingInvoices(body);

    // If specific customer generation was requested and no invoice was produced:
    if (body.customerId && result.invoicesGenerated === 0) {
      if (result.skippedBelowMinimumCount > 0) {
        const skipped = result.skippedBelowMinimum[0];
        const accruedStr = skipped ? formatPaiseToRupees(skipped.amountPaise) : '₹0.00';
        return NextResponse.json(
          {
            error: `Invoice generation rejected: Accrued unbilled usage (${accruedStr}) is below the ₹5.00 minimum threshold.`,
            result,
          },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          {
            error: 'No unbilled usage found for this customer in the selected period (or already billed).',
            result,
          },
          { status: 400 }
        );
      }
    }

    const amountStr = formatPaiseToRupees(result.totalAmountPaise);
    const skippedStr =
      result.skippedBelowMinimumCount > 0
        ? `, skipped ${result.skippedBelowMinimumCount} below ₹5 min`
        : '';

    return NextResponse.json({
      success: true,
      result,
      message: `Generated ${result.invoicesGenerated} invoices (${amountStr})${skippedStr}, marked ${result.overdueInvoicesCount} overdue.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Batch invoice generation failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
