import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { getAllCustomersLiveUsage } from '@/lib/billing';

export async function GET(_req: NextRequest) {
  try {
    await requireAdminAPI();
    const usage = await getAllCustomersLiveUsage();
    return NextResponse.json({ success: true, usage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch live billing usage';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
