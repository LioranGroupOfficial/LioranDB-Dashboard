import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  const testId = 'test-ip-123';

  afterEach(() => {
    resetRateLimit('login', testId);
  });

  test('allows requests within limit', () => {
    const res1 = checkRateLimit('login', testId);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(9);

    const res2 = checkRateLimit('login', testId);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(8);
  });

  test('blocks requests when threshold exceeded', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('login', testId);
    }
    const blocked = checkRateLimit('login', testId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});

