/**
 * SHA256 Hash Utilities for Idempotency
 * 
 * Creates deterministic hashes for batch requests to ensure
 * idempotent operations and prevent duplicate processing
 */

import crypto from 'crypto';

/**
 * Create SHA256 hash of a string
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create a deterministic batch hash from batch data
 * This ensures the same batch always produces the same hash
 * 
 * @param batchData - The batch data to hash
 * @returns 64-character hex hash
 */
export function createBatchHash(batchData: {
  rows: Array<{
    sceneId: string;
    prompt: string;
    variants: number;
  }>;
  userId?: string;
  timestamp?: number;
}): string {
  // Sort rows by sceneId to ensure consistent ordering
  const sortedRows = [...batchData.rows].sort((a, b) => 
    a.sceneId.localeCompare(b.sceneId)
  );

  // Create canonical representation
  const canonical = {
    rows: sortedRows.map(row => ({
      sceneId: row.sceneId.trim(),
      prompt: row.prompt.trim(),
      variants: row.variants
    })),
    // Include userId if provided for user-specific idempotency
    ...(batchData.userId && { userId: batchData.userId }),
    // Optionally include timestamp for time-based uniqueness
    ...(batchData.timestamp && { 
      timestamp: Math.floor(batchData.timestamp / 1000) // Round to seconds
    })
  };

  // Create stable JSON representation
  const jsonString = JSON.stringify(canonical, null, 0);
  
  return sha256(jsonString);
}

/**
 * Create a hash for file uploads
 * Combines file content with metadata for uniqueness
 */
export async function createFileHash(
  file: File | Blob,
  metadata?: { userId?: string; batchId?: string }
): Promise<string> {
  // Read file as array buffer
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  
  // Create hash of file content
  const contentHash = crypto.createHash('sha256');
  contentHash.update(uint8Array);
  
  // Add metadata if provided
  if (metadata) {
    contentHash.update(JSON.stringify(metadata));
  }
  
  return contentHash.digest('hex');
}

/**
 * Create a short hash for display purposes
 * Takes first 8 characters of full hash
 */
export function shortHash(fullHash: string): string {
  return fullHash.substring(0, 8);
}

/**
 * Validate if a string is a valid SHA256 hash
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Create a hash for status polling
 * Ensures we're polling for the right batch
 */
export function createStatusHash(
  batchId: string,
  userId?: string
): string {
  const data = {
    batchId,
    ...(userId && { userId })
  };
  
  return sha256(JSON.stringify(data));
}

/**
 * Generate a unique request ID for tracking
 * Combines timestamp with random bytes for uniqueness
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomBytes}`;
}

/**
 * Hash sensitive data for logging
 * Useful for logging API keys, user IDs, etc. without exposing them
 */
export function hashForLogging(sensitive: string): string {
  const hash = sha256(sensitive);
  return `${sensitive.substring(0, 4)}...${hash.substring(0, 8)}`;
}