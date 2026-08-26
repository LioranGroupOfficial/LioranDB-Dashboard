import { NextRequest } from 'next/server';
import { SignupSchema, getZodFieldErrors } from '@/lib/validation/schemas';
import { signupUser } from '@/lib/services/auth.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError } from '@/lib/errors';
import { getSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // Rate limiting
    const rl = checkRateLimit('signup', ip);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = getZodFieldErrors(parsed.error);
      return Response.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const userAgent = req.headers.get('user-agent') || undefined;

    const { userId } = await signupUser(email, password, ip, userAgent);

    // Create session so verify-email page can check who's logged in
    const session = await getSession();
    session.userId = userId;
    session.email = email;
    session.role = 'customer';
    session.emailVerified = false;
    await session.save();

    return Response.json({ success: true, userId });
  } catch (error) {
    return createApiError(error);
  }
}
