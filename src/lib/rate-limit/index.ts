type RateLimitEntry = { count: number; resetAt: number };
const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitOptions> = {
  login: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  signup: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  verify_otp: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  resend_otp: { maxRequests: 3, windowMs: 10 * 60 * 1000 },
  forgot_password: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  reset_password: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  ticket_create: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  admin_action: { maxRequests: 60, windowMs: 60 * 1000 },
};

export function checkRateLimit(
  action: string,
  identifier: string
): { allowed: boolean; remaining: number; resetAt: Date } {
  const limit = LIMITS[action];
  if (!limit) {
    return { allowed: true, remaining: 999, resetAt: new Date() };
  }

  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + limit.windowMs });
    return {
      allowed: true,
      remaining: limit.maxRequests - 1,
      resetAt: new Date(now + limit.windowMs),
    };
  }

  if (entry.count >= limit.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit.maxRequests - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

export function resetRateLimit(action: string, identifier: string): void {
  store.delete(`${action}:${identifier}`);
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}
