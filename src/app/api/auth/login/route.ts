import { NextRequest, NextResponse } from 'next/server';
import { LoginSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { loginUser } from '@/lib/services/auth.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError, AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // Rate limiting
    const rl = checkRateLimit('login', ip);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const userAgent = req.headers.get('user-agent') || undefined;

    const session = await loginUser(email, password, ip, userAgent);

    return Response.json({
      success: true,
      user: {
        email: session.email,
        role: session.role,
        emailVerified: session.emailVerified,
      },
    });
  } catch (error) {
    return createApiError(error);
  }
}
