import { redirect } from 'next/navigation';
import { getCurrentUser, SessionData } from './session';
import type { UserRole } from '../db/models/User';

export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
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

export async function requireRoleAPI(role: UserRole): Promise<SessionData> {
  const user = await requireUserAPI();
  if (user.role !== role) {
    throw new AuthorizationError(`Requires role: ${role}`);
  }
  return user;
}

export async function requireAnyRoleAPI(roles: UserRole[]): Promise<SessionData> {
  const user = await requireUserAPI();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError(`Requires one of roles: ${roles.join(', ')}`);
  }
  return user;
}
