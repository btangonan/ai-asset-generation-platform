/**
 * Returns true if a signed URL should be refreshed because it will expire soon.
 * Default threshold: < 5 minutes TTL remaining.
 */
export function needsRefresh(expiryEpochMs: number, minTtlMs = 5 * 60 * 1000) {
  return expiryEpochMs - Date.now() < minTtlMs;
}