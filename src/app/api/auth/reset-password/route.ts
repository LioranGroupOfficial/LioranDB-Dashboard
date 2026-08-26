import { NextRequest } from 'next/server';
import { ResetPasswordSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { resetPassword } from '@/lib/services/auth.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const rl = checkRateLimit('reset_password', ip);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    const result = await resetPassword(parsed.data.token, parsed.data.password, ip, userAgent);

    if (!result.success) {
      return Response.json({ error: result.message }, { status: 400 });
    }

    return Response.json({ success: true, message: result.message });
  } catch (error) {
    return createApiError(error);
  }
}
