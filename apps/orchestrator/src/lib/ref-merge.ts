import { createHash } from 'crypto';
import { RefUrl } from '@ai-platform/shared';
import pLimit from 'p-limit';

// Bounded pool: max 4 concurrent fetches
const limit = pLimit(4);

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithTimeout(
  url: string, 
  timeout = 10000,
  retries = 2
): Promise<Buffer> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'AI-Platform/1.0' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch reference');
}

/**
 * Generate SHA-256 hash for content deduplication
 */
async function hashUrl(url: string): Promise<string> {
  try {
    // Use bounded pool to fetch with timeout and retries
    const content = await limit(() => fetchWithTimeout(url));
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    // Fallback to URL hash if fetch fails
    console.warn(`Failed to fetch ${url} for hashing:`, error);
    return createHash('sha256').update(url).digest('hex');
  }
}

/**
 * Merge reference images with SHA-256 deduplication
 * Priority: per-row refs first, then global pack
 * Cap at 6 total references
 */
export async function mergeRefs(
  rowRefs: RefUrl[] = [],
  globalRefs: RefUrl[] = [],
  cap = 6,
  hasher = hashUrl
): Promise<RefUrl[]> {
  const seen = new Set<string>();
  const merged: RefUrl[] = [];
  
  // Per-row refs have priority
  for (const ref of rowRefs) {
    if (merged.length >= cap) break;
    const hash = await hasher(ref.url);
    if (!seen.has(hash)) {
      seen.add(hash);
      merged.push({ ...ref, hash });
    }
  }
  
  // Add global refs to fill remaining slots
  for (const ref of globalRefs) {
    if (merged.length >= cap) break;
    const hash = await hasher(ref.url);
    if (!seen.has(hash)) {
      seen.add(hash);
      merged.push({ ...ref, hash });
    }
  }
  
  return merged;
}