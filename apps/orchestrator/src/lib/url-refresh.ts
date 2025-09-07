import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;  // 5 minutes

/**
 * Track when URLs were generated
 */
const urlTimestamps = new Map<string, number>();

/**
 * Generate fresh signed URL
 */
async function generateSignedUrl(gcsUri: string): Promise<string> {
  const [bucket, ...pathParts] = gcsUri.replace('gs://', '').split('/');
  if (!bucket) {
    throw new Error(`Invalid GCS URI: ${gcsUri}`);
  }
  const file = storage.bucket(bucket).file(pathParts.join('/'));
  
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + URL_TTL_MS,
  });
  
  urlTimestamps.set(url, Date.now());
  return url;
}

/**
 * Check if URL needs refresh (TTL < 5 minutes)
 */
function needsRefresh(url: string): boolean {
  const generatedAt = urlTimestamps.get(url);
  if (!generatedAt) return true;
  
  const timeElapsed = Date.now() - generatedAt;
  const timeRemaining = URL_TTL_MS - timeElapsed;
  
  return timeRemaining < REFRESH_THRESHOLD_MS;
}

/**
 * Refresh signed URLs if needed
 */
export async function refreshUrlsIfNeeded(
  urls: Array<{ url: string; gcsUri: string }>
): Promise<string[]> {
  const refreshed = await Promise.all(
    urls.map(async ({ url, gcsUri }) => {
      if (needsRefresh(url)) {
        console.log(`Refreshing URL with TTL < 5min: ${url.substring(0, 50)}...`);
        return generateSignedUrl(gcsUri);
      }
      return url;
    })
  );
  
  return refreshed;
}

/**
 * Batch-aware URL refresh for long-running operations
 */
export async function refreshForLongBatch(
  startTime: number,
  urls: Array<{ url: string; gcsUri: string }>
): Promise<string[]> {
  const elapsed = Date.now() - startTime;
  
  // If batch has been running >5 minutes, proactively refresh
  if (elapsed > REFRESH_THRESHOLD_MS) {
    console.log(`Batch running for ${Math.round(elapsed / 60000)}min, refreshing URLs`);
    return Promise.all(urls.map(({ gcsUri }) => generateSignedUrl(gcsUri)));
  }
  
  return refreshUrlsIfNeeded(urls);
}