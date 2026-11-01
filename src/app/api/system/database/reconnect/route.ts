import { NextRequest, NextResponse } from 'next/server';
import { reconnectToDatabase } from '@/lib/db/connection';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await rateLimit(`database:reconnect:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many reconnect attempts. Please try again shortly.' }, { status: 429 });
  }

  try {
    await reconnectToDatabase();
    return NextResponse.json({ success: true });
  } catch {
    // Keep the response generic: driver errors can contain connection details.
    return NextResponse.json(
      { success: false, error: 'LioranDB is still unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
