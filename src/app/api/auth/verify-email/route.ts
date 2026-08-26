import { NextRequest } from 'next/server';
import { VerifyOTPSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { verifyEmailOTP } from '@/lib/services/auth.service';
import { requireUserAPI } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserAPI();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const rl = checkRateLimit('verify_otp', user.userId);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many verification attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = VerifyOTPSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    const result = await verifyEmailOTP(user.userId, parsed.data.otp, ip, userAgent);

    if (!result.success) {
      return Response.json({ error: result.message }, { status: 400 });
    }

    return Response.json({ success: true, message: result.message });
  } catch (error) {
    return createApiError(error);
  }
}
