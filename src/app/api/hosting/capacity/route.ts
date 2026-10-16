import { NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { getHostingCapacitySummary, triggerBackgroundRecovery } from '@/lib/providers/recovery';
import { createApiError } from '@/lib/errors';

/**
 * Customer-accessible hosting node capacity and status endpoint.
 *
 * Returns authoritative real-time capacity and triggers background recovery
 * for eligible unassigned nodes when available capacity is 0.
 *
 * GET requests remain strictly read-only and return immediately.
 */
export async function GET() {
  try {
    await requireAccountVerifiedUserAPI();

    const summary = await getHostingCapacitySummary();

    // If no nodes are currently available but eligible unassigned nodes exist,
    // trigger a non-blocking background recovery sweep so capacity becomes available.
    if (summary.availableCount === 0 && (summary.stoppedCleanCount > 0 || summary.recoveringCount > 0)) {
      triggerBackgroundRecovery({ source: 'customer_capacity_api' });
    }

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
