import { env } from './env.js';

// Placeholder rate limiting - replace with Redis/Firestore in production
const userLastRequest = new Map<string, number>();

interface RateLimitResult {
  allowed: boolean;
  retryAfterMinutes?: number;
}

export async function validateRateLimit(userId: string): Promise<RateLimitResult> {
  // Skip rate limiting in test environment
  if (env.NODE_ENV === 'test') {
    return { allowed: true };
  }

  const now = Date.now();
  const lastRequest = userLastRequest.get(userId) || 0;
  const cooldownMs = env.USER_COOLDOWN_MINUTES * 60 * 1000;
  const timeSinceLastRequest = now - lastRequest;

  if (timeSinceLastRequest < cooldownMs) {
    const retryAfterMinutes = Math.ceil((cooldownMs - timeSinceLastRequest) / 60000);
    return {
      allowed: false,
      retryAfterMinutes,
    };
  }

  userLastRequest.set(userId, now);
  return { allowed: true };
}