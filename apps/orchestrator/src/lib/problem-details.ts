import type { FastifyReply } from 'fastify';

/**
 * RFC 7807 Problem Details for HTTP APIs
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /** A URI reference that identifies the problem type */
  type: string;
  /** A short, human-readable summary of the problem type */
  title: string;
  /** The HTTP status code for this occurrence of the problem */
  status: number;
  /** A human-readable explanation specific to this occurrence */
  detail?: string;
  /** A URI reference that identifies the specific occurrence */
  instance?: string;
  /** Additional members that provide more details about the problem */
  [key: string]: unknown;
}

/**
 * Predefined problem types for common API errors
 */
export const ProblemTypes = {
  INVALID_REQUEST_SCHEMA: 'https://api.ai-platform.com/problems/invalid-request-schema',
  BATCH_SIZE_EXCEEDED: 'https://api.ai-platform.com/problems/batch-size-exceeded', 
  INVALID_VARIANTS: 'https://api.ai-platform.com/problems/invalid-variants',
  RATE_LIMITED: 'https://api.ai-platform.com/problems/rate-limited',
  SHEET_NOT_FOUND: 'https://api.ai-platform.com/problems/sheet-not-found',
  PERMISSION_DENIED: 'https://api.ai-platform.com/problems/permission-denied',
  INTERNAL_ERROR: 'https://api.ai-platform.com/problems/internal-error',
  SERVICE_UNAVAILABLE: 'https://api.ai-platform.com/problems/service-unavailable',
  VALIDATION_ERROR: 'https://api.ai-platform.com/problems/validation-error',
  NOT_IMPLEMENTED: 'https://api.ai-platform.com/problems/not-implemented'
} as const;

/**
 * Send a RFC 7807 Problem Details response
 */
export function sendProblemDetails(
  reply: FastifyReply,
  problem: Omit<ProblemDetails, 'instance'> & { instance?: string }
): FastifyReply {
  // Set the instance to the current request URL if not provided
  const instance = problem.instance || reply.request.url;
  
  const problemDetails: ProblemDetails = {
    type: problem.type as string,
    title: problem.title as string,
    status: problem.status as number,
    instance
  };
  
  if (problem.detail) {
    problemDetails.detail = problem.detail as string;
  }

  return reply
    .status(problem.status as number)
    .header('Content-Type', 'application/problem+json')
    .send(problemDetails);
}

/**
 * Helper functions for common error scenarios
 */
export const Problems = {
  invalidRequestSchema: (detail: string, issues?: unknown[]): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.INVALID_REQUEST_SCHEMA,
    title: 'Invalid Request Schema',
    status: 400,
    detail,
    issues: issues || undefined
  }),

  batchSizeExceeded: (maxSize: number): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.BATCH_SIZE_EXCEEDED,
    title: 'Batch Size Exceeded',
    status: 400,
    detail: `Maximum ${maxSize} items per batch`,
    maxSize
  }),

  invalidVariants: (min: number, max: number, invalidItems?: string[]): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.INVALID_VARIANTS,
    title: 'Invalid Variants',
    status: 400,
    detail: `Variants must be between ${min} and ${max}`,
    minVariants: min,
    maxVariants: max,
    invalidItems: invalidItems || undefined
  }),

  rateLimited: (retryAfterMinutes: number): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.RATE_LIMITED,
    title: 'Rate Limited',
    status: 429,
    detail: `Please wait ${retryAfterMinutes} minutes before retrying`,
    retryAfterMinutes
  }),

  sheetNotFound: (sheetId: string): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.SHEET_NOT_FOUND,
    title: 'Sheet Not Found',
    status: 404,
    detail: `Google Sheet with ID '${sheetId}' not found or not accessible`,
    sheetId
  }),

  permissionDenied: (detail: string): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.PERMISSION_DENIED,
    title: 'Permission Denied',
    status: 403,
    detail
  }),

  internalError: (detail?: string): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.INTERNAL_ERROR,
    title: 'Internal Server Error',
    status: 500,
    detail: detail || 'An unexpected error occurred'
  }),

  serviceUnavailable: (detail?: string): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.SERVICE_UNAVAILABLE,
    title: 'Service Unavailable',
    status: 503,
    detail: detail || 'Service is temporarily unavailable'
  }),

  notImplemented: (feature: string): Omit<ProblemDetails, 'instance'> => ({
    type: ProblemTypes.NOT_IMPLEMENTED,
    title: 'Not Implemented',
    status: 501,
    detail: `${feature} is not yet implemented`
  })
};