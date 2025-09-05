export class AIAssetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AIAssetError';
  }
}

export class ValidationError extends AIAssetError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AIAssetError {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends AIAssetError {
  constructor(message: string, public readonly quotaType: string) {
    super(message, 'QUOTA_EXCEEDED', 429);
    this.name = 'QuotaExceededError';
  }
}

export class ExternalServiceError extends AIAssetError {
  constructor(
    service: string, 
    message: string, 
    public readonly originalError?: Error
  ) {
    super(`${service}: ${message}`, `${service.toUpperCase()}_ERROR`, 502);
    this.name = 'ExternalServiceError';
  }
}

export class JobNotFoundError extends AIAssetError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', 404);
    this.name = 'JobNotFoundError';
  }
}