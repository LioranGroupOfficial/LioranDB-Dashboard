import { NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { createApiError } from '@/lib/errors';
import { inspectSharedHostingConsistency } from '@/lib/services/shared-hosting.service';

/** Read-only Dashboard/Rust shared-hosting consistency diagnostics. */
export async function GET() {
  try {
    await requireAdminAPI();
    const report = await inspectSharedHostingConsistency();
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
