import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { runHostingRecovery, getHostingCapacitySummary } from '@/lib/providers/recovery';

/**
 * Admin-only bulk hosting node recovery action.
 *
 * Runs bounded recovery across all eligible unassigned hosting nodes:
 * starts stopped containers, tests Rust control planes, verifies clean state,
 * and releases eligible nodes from quarantine to AVAILABLE.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);

    const results = await runHostingRecovery({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      force,
    });

    const summary = await getHostingCapacitySummary();

    return NextResponse.json({
      success: true,
      recoveredCount: results.filter((r) => r.recovered).length,
      totalProcessed: results.length,
      results,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk recovery failed';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
