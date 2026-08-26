import { NextRequest } from 'next/server';
import { ForgotPasswordSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { requestPasswordReset } from '@/lib/services/auth.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const rl = checkRateLimit('forgot_password', ip);
    if (!rl.allowed) {
      // Still return 200 to prevent timing-based enumeration
      return Response.json({ success: true });
    }

    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    // Fire and forget — same response regardless of outcome
    await requestPasswordReset(parsed.data.email, ip);

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}
