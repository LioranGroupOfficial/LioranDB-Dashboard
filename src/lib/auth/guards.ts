import { redirect } from 'next/navigation';
import { getCurrentUser, SessionData } from './session';
import type { UserRole, IUser } from '../db/models/User';
import { connectToDatabase, User } from '../db';
import { AccountVerificationRequiredError } from '../errors';

export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Check whether a user has completed the mandatory account verification.
 * Admins and support staff are exempt.
 * Existing customers with accountRegistrationPaid or accountVerification.feePaid are verified.
 */
export function isAccountVerified(
  user: Partial<IUser> | { role?: string; accountVerification?: { feePaid?: boolean }; accountRegistrationPaid?: boolean } | null | undefined
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'support') return true;
  if (user.accountVerification?.feePaid === true) return true;
  if (user.accountRegistrationPaid === true) return true;
  return false;
}

/**
 * Requires a logged-in user. Redirects to /login if not authenticated.
 * Use in Server Components and Server Actions.
 */
export async function requireUser(): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Requires a logged-in user with a verified email.
 */
export async function requireVerifiedUser(): Promise<SessionData> {
  const user = await requireUser();
  if (!user.emailVerified) {
    redirect('/verify-email');
  }
  return user;
}

/**
 * Requires a logged-in user with verified email AND paid account verification fee.
 * Redirects to /verify-account if the ₹30 fee has not been paid.
 */
export async function requireAccountVerifiedUser(): Promise<SessionData> {
  const user = await requireVerifiedUser();
  if (user.role === 'customer') {
    await connectToDatabase();
    const dbUser = await User.findById(user.userId).select('accountVerification accountRegistrationPaid role').lean();
    if (!isAccountVerified(dbUser as unknown as IUser)) {
      redirect('/verify-account');
    }
  }
  return user;
}

/**
 * Standard customer guard: verified email and account verification required.
 */
export async function requireRegisteredUser(): Promise<SessionData> {
  return requireAccountVerifiedUser();
}

/**
 * Requires a specific role. Use in Server Components (redirects on failure).
 */
export async function requireRole(role: UserRole): Promise<SessionData> {
  const user = await requireUser();
  if (user.role !== role) {
    redirect('/dashboard');
  }
  return user;
}

/**
 * Requires any of the specified roles.
 */
export async function requireAnyRole(roles: UserRole[]): Promise<SessionData> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect('/dashboard');
  }
  return user;
}

/**
 * For API Route Handlers - throws if not authenticated.
 */
export async function requireUserAPI(): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError('Authentication required');
  }
  return user;
}

/**
 * For API Route Handlers - throws if not authenticated or email unverified.
 */
export async function requireVerifiedUserAPI(): Promise<SessionData> {
  const user = await requireUserAPI();
  if (!user.emailVerified) {
    throw new AuthorizationError('Email verification required');
  }
  return user;
}

/**
 * For API Route Handlers - throws if account verification fee is unpaid.
 * Returns 403 with structured payload.
 */
export async function requireAccountVerifiedUserAPI(): Promise<SessionData> {
  const user = await requireVerifiedUserAPI();
  if (user.role === 'customer') {
    await connectToDatabase();
    const dbUser = await User.findById(user.userId).select('accountVerification accountRegistrationPaid role').lean();
    if (!isAccountVerified(dbUser as unknown as IUser)) {
      throw new AccountVerificationRequiredError('Complete the one-time ₹30 account verification payment.');
    }
  }
  return user;
}

export async function requireRegisteredUserAPI(): Promise<SessionData> {
  return requireAccountVerifiedUserAPI();
}

export async function requireRoleAPI(role: UserRole): Promise<SessionData> {
  const user = await requireUserAPI();
  if (user.role !== role) {
    throw new AuthorizationError(`Requires role: ${role}`);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionData> {
  return requireRole('admin');
}

export async function requireAdminAPI(): Promise<SessionData> {
  return requireRoleAPI('admin');
}

export async function requireAnyRoleAPI(roles: UserRole[]): Promise<SessionData> {
  const user = await requireUserAPI();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError(`Requires one of roles: ${roles.join(', ')}`);
  }
  return user;
}

