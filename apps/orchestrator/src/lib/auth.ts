import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import { env } from './env.js';
import { sendProblemDetails, ProblemTypes } from './problem-details.js';
import { logger } from './logger.js';

/**
 * Valid API keys for the system
 * In production, these should be stored in a secure key management system
 */
const VALID_API_KEYS: Set<string> = new Set([
  env.AI_PLATFORM_API_KEY_1,
  env.AI_PLATFORM_API_KEY_2,
  env.AI_PLATFORM_API_KEY_3,
].filter((key): key is string => typeof key === 'string' && key.length > 0)); // Remove undefined keys

/**
 * Hash an API key for secure comparison
 */
function hashApiKey(key: string): Buffer {
  return Buffer.from(createHash('sha256').update(key, 'utf8').digest());
}

/**
 * Securely compare two API keys using constant-time comparison
 */
function compareApiKeys(provided: string, valid: string): boolean {
  try {
    const providedHash = hashApiKey(provided);
    const validHash = hashApiKey(valid);
    
    // Ensure both hashes are the same length for timing safety
    if (providedHash.length !== validHash.length) {
      return false;
    }
    
    return timingSafeEqual(providedHash, validHash);
  } catch (error) {
    logger.warn({ error }, 'API key comparison failed');
    return false;
  }
}

/**
 * Validate API key format
 */
function isValidApiKeyFormat(key: string): boolean {
  // API keys should start with 'aip_' and be at least 40 characters
  if (!key.startsWith('aip_') || key.length < 40) {
    return false;
  }
  
  // Should contain only base64-safe characters after prefix
  const keyBody = key.slice(4);
  return /^[A-Za-z0-9+/=_-]+$/.test(keyBody);
}

/**
 * Extract API key from request headers
 */
function extractApiKey(request: FastifyRequest): string | null {
  // Check Authorization header (Bearer format)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Check X-API-Key header
  const apiKeyHeader = request.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }
  
  return null;
}

/**
 * Authentication middleware
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip authentication in test mode for automated tests
  if (env.NODE_ENV === 'test') {
    return;
  }
  
  // Skip authentication for health check endpoint
  if (request.url === '/healthz') {
    return;
  }
  
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    logger.warn({ 
      url: request.url,
      method: request.method,
      ip: request.ip 
    }, 'Authentication failed: No API key provided');
    
    sendProblemDetails(reply, {
      type: ProblemTypes.PERMISSION_DENIED,
      title: 'Authentication Required',
      status: 401,
      detail: 'API key required. Provide key via Authorization: Bearer <key> or X-API-Key header.'
    });
    return;
  }
  
  if (!isValidApiKeyFormat(apiKey)) {
    logger.warn({ 
      url: request.url,
      method: request.method,
      ip: request.ip,
      keyPrefix: apiKey.slice(0, 8) + '...'
    }, 'Authentication failed: Invalid API key format');
    
    sendProblemDetails(reply, {
      type: ProblemTypes.PERMISSION_DENIED,
      title: 'Invalid API Key Format',
      status: 401,
      detail: 'API key must start with "aip_" and be properly formatted.'
    });
    return;
  }
  
  // Check against valid keys
  let isValid = false;
  for (const validKey of VALID_API_KEYS) {
    if (compareApiKeys(apiKey, validKey)) {
      isValid = true;
      break;
    }
  }
  
  if (!isValid) {
    logger.warn({ 
      url: request.url,
      method: request.method,
      ip: request.ip,
      keyPrefix: apiKey.slice(0, 8) + '...'
    }, 'Authentication failed: Invalid API key');
    
    sendProblemDetails(reply, {
      type: ProblemTypes.PERMISSION_DENIED,
      title: 'Invalid API Key',
      status: 401,
      detail: 'The provided API key is not valid.'
    });
    return;
  }
  
  // Add API key info to request for logging/rate limiting
  (request as any).apiKey = {
    keyPrefix: apiKey.slice(0, 8) + '...',
    hash: hashApiKey(apiKey).toString('hex').slice(0, 16)
  };
  
  logger.info({ 
    url: request.url,
    method: request.method,
    keyPrefix: (request as any).apiKey.keyPrefix
  }, 'Authentication successful');
}

/**
 * Generate a new secure API key
 * Use this for creating new API keys (run manually)
 */
export function generateApiKey(): string {
  const randomBytes = Buffer.from(Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 256)
  ));
  const keyBody = randomBytes.toString('base64url');
  return `aip_${keyBody}`;
}

/**
 * Validate if authentication is properly configured (non-fatal)
 */
export function validateAuthConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (VALID_API_KEYS.size === 0) {
    errors.push('No API keys configured. Authentication disabled.');
  }
  
  if (VALID_API_KEYS.size < 2 && env.NODE_ENV === 'production' && VALID_API_KEYS.size > 0) {
    errors.push('Production environments should have at least 2 API keys for key rotation.');
  }
  
  for (const key of VALID_API_KEYS) {
    if (!isValidApiKeyFormat(key)) {
      errors.push(`Invalid API key format: ${key.slice(0, 8)}... - disabling key`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Initialize authentication system with graceful degradation
 */
export function initAuth(): { enabled: boolean; warnings: string[] } {
  const validation = validateAuthConfiguration();
  
  if (!validation.valid) {
    logger.warn('Authentication system warnings:', validation.errors);
    return {
      enabled: VALID_API_KEYS.size > 0,
      warnings: validation.errors
    };
  }
  
  logger.info(`Authentication enabled with ${VALID_API_KEYS.size} valid API keys`);
  return {
    enabled: true,
    warnings: []
  };
}