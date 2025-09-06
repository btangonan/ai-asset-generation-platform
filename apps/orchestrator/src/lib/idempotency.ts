import { createHash } from 'crypto';
import type { ImageBatchItem } from '@ai-platform/shared';

/**
 * Generate a deterministic job ID based on request content
 * Uses SHA256 hash of normalized request data for idempotency
 */
export function generateJobId(
  userId: string,
  items: ImageBatchItem[],
  timestamp: number = Date.now()
): string {
  // Normalize items for consistent hashing
  const normalizedItems = items.map(item => ({
    scene_id: item.scene_id.trim().toLowerCase(),
    prompt: item.prompt.trim(),
    ref_pack_public_urls: item.ref_pack_public_urls?.sort() || [],
    variants: item.variants,
  }));
  
  // Create deterministic content for hashing
  const content = JSON.stringify({
    userId,
    items: normalizedItems,
    // Include timestamp window for reasonable uniqueness (5 minute windows)
    timeWindow: Math.floor(timestamp / (5 * 60 * 1000)),
  });
  
  // Generate SHA256 hash
  const hash = createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 12); // Use first 12 chars for readability
  
  return `batch_${Math.floor(timestamp / 1000)}_${hash}`;
}

/**
 * Generate a deterministic scene job ID
 * Used for individual scene processing within a batch
 */
export function generateSceneJobId(
  batchJobId: string,
  sceneId: string,
  variantNum: number
): string {
  const content = `${batchJobId}_${sceneId}_${variantNum}`;
  const hash = createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 8);
  
  return `job_${Date.now()}_${hash}`;
}

/**
 * Check if a job ID exists in cache/storage
 * This would typically check against Firestore or Redis
 */
export async function checkJobExists(jobId: string): Promise<boolean> {
  // TODO: Implement actual cache/storage check
  // For now, always return false (no duplicates)
  return false;
}

/**
 * Store job ID with metadata for deduplication
 */
export async function storeJobId(
  jobId: string,
  metadata: {
    userId: string;
    items: ImageBatchItem[];
    createdAt: Date;
    expiresAt: Date;
  }
): Promise<void> {
  // TODO: Implement actual storage (Firestore/Redis)
  // For now, this is a no-op
  console.log(`Would store job ${jobId} with metadata`, metadata);
}