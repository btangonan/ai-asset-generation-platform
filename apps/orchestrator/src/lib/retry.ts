import { logger } from './logger.js';

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  retryableErrors?: number[];
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_RETRYABLE_ERRORS = [429, 500, 502, 503, 504];

/**
 * Elegant retry helper with exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 15000,
    jitterMs = 250,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const statusCode = error.status || error.code || error.response?.status;
      const isRetryable = retryableErrors.includes(statusCode) || 
                         error.code === 'ECONNRESET' ||
                         error.code === 'ETIMEDOUT';
      
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }
      
      const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.random() * jitterMs;
      const delay = baseDelay + jitter;
      
      logger.warn({
        attempt,
        maxAttempts,
        error: error.message,
        statusCode,
        delayMs: Math.round(delay)
      }, 'Retrying after error');
      
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(tokens = 1): Promise<void> {
    while (true) {
      this.refill();
      
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}