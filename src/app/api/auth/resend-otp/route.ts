import { requireUserAPI } from '@/lib/auth/guards';
import { resendVerificationOTP } from '@/lib/services/auth.service';
import { createApiError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { connectToDatabase, User } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const rl = checkRateLimit('resend_otp', sessionUser.userId);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many resend attempts. Please wait before requesting again.' },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.emailVerified) {
      return Response.json({ error: 'Email is already verified.' }, { status: 400 });
    }

    const result = await resendVerificationOTP(user._id.toString(), user.email);

    if (!result.success) {
      return Response.json(
        { error: result.message, cooldownSeconds: result.cooldownSeconds },
        { status: 429 }
      );
    }

    return Response.json({ success: true, message: result.message });
  } catch (error) {
    return createApiError(error);
  }
}
