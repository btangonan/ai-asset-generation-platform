import { env } from './env.js';
import { logger } from './logger.js';

// In-memory storage for development, replace with Redis/Firestore in production
const userLastRequest = new Map<string, number>();
const userRequestCount = new Map<string, number>();

interface RateLimitResult {
  allowed: boolean;
  retryAfterMinutes?: number;
  reason?: string;
}

interface UserActivity {
  lastRequestTime: number;
  requestCount: number;
  dailyCount: number;
  lastResetDate: string;
}

// Track user activity
const userActivity = new Map<string, UserActivity>();

/**
 * Validate rate limit for a user
 * Implements 10-minute cooldown between batches
 */
export async function validateRateLimit(userId: string): Promise<RateLimitResult> {
  // Skip rate limiting in test environment
  if (env.NODE_ENV === 'test') {
    return { allowed: true };
  }
  
  // Skip rate limiting in dry run mode
  if (env.RUN_MODE === 'dry_run') {
    logger.info({ userId }, 'Dry run mode - skipping rate limit');
    return { allowed: true };
  }

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  // Get or create user activity
  let activity = userActivity.get(userId);
  if (!activity) {
    activity = {
      lastRequestTime: 0,
      requestCount: 0,
      dailyCount: 0,
      lastResetDate: today!,
    };
    userActivity.set(userId, activity);
  }
  
  // Reset daily count if it's a new day
  if (activity.lastResetDate !== today) {
    activity.dailyCount = 0;
    activity.lastResetDate = today!;
  }
  
  // Check cooldown period (10 minutes by default)
  const cooldownMs = (env.USER_COOLDOWN_MINUTES || 10) * 60 * 1000;
  const timeSinceLastRequest = now - activity.lastRequestTime;
  
  if (timeSinceLastRequest < cooldownMs) {
    const retryAfterMinutes = Math.ceil((cooldownMs - timeSinceLastRequest) / 60000);
    logger.warn({ 
      userId, 
      retryAfterMinutes,
      lastRequest: new Date(activity.lastRequestTime).toISOString(),
    }, 'User rate limited - cooldown period');
    
    return {
      allowed: false,
      retryAfterMinutes,
      reason: `Please wait ${retryAfterMinutes} minutes before submitting another batch`,
    };
  }
  
  // Check daily limit (optional)
  const dailyLimit = env.USER_DAILY_LIMIT || 100;
  if (activity.dailyCount >= dailyLimit) {
    logger.warn({ userId, dailyCount: activity.dailyCount }, 'User rate limited - daily limit');
    return {
      allowed: false,
      reason: `Daily limit of ${dailyLimit} batches reached. Resets at midnight UTC.`,
    };
  }
  
  // Update activity
  activity.lastRequestTime = now;
  activity.requestCount++;
  activity.dailyCount++;
  
  logger.info({ 
    userId, 
    requestCount: activity.requestCount,
    dailyCount: activity.dailyCount,
  }, 'Rate limit check passed');
  
  return { allowed: true };
}

/**
 * Get user's current rate limit status
 */
export async function getUserRateLimitStatus(userId: string): Promise<{
  nextAvailableTime: Date | null;
  dailyRemaining: number;
  totalRequests: number;
}> {
  const activity = userActivity.get(userId);
  
  if (!activity) {
    return {
      nextAvailableTime: null,
      dailyRemaining: env.USER_DAILY_LIMIT || 100,
      totalRequests: 0,
    };
  }
  
  const cooldownMs = (env.USER_COOLDOWN_MINUTES || 10) * 60 * 1000;
  const nextAvailable = activity.lastRequestTime + cooldownMs;
  const dailyLimit = env.USER_DAILY_LIMIT || 100;
  
  return {
    nextAvailableTime: nextAvailable > Date.now() ? new Date(nextAvailable) : null,
    dailyRemaining: Math.max(0, dailyLimit - activity.dailyCount),
    totalRequests: activity.requestCount,
  };
}

/**
 * Clear rate limit for a user (admin function)
 */
export async function clearUserRateLimit(userId: string): Promise<void> {
  userActivity.delete(userId);
  userLastRequest.delete(userId);
  userRequestCount.delete(userId);
  logger.info({ userId }, 'Rate limit cleared for user');
}

/**
 * Cleanup old entries periodically to prevent memory leaks
 */
export function startRateLimitCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, activity] of userActivity.entries()) {
      if (now - activity.lastRequestTime > staleThreshold) {
        userActivity.delete(userId);
        userLastRequest.delete(userId);
        userRequestCount.delete(userId);
        logger.debug({ userId }, 'Cleaned up stale rate limit entry');
      }
    }
  }, 60 * 60 * 1000); // Run every hour
}