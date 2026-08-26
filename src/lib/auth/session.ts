import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId: string;
  email: string;
  role: 'customer' | 'admin' | 'support';
  emailVerified: boolean;
}

const SESSION_OPTIONS = {
  password: process.env.AUTH_SECRET || 'dev_secret_please_change_in_production_32chars',
  cookieName: 'liorandb_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export async function getCurrentUser(): Promise<SessionData | null> {
  try {
    const session = await getSession();
    if (!session.userId) return null;
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      emailVerified: session.emailVerified,
    };
  } catch {
    return null;
  }
}

export { SESSION_OPTIONS };
