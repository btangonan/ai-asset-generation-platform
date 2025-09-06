import { GeminiImageClient, type GCSOperations } from '@ai-platform/clients';
import { env } from './env.js';
import { putObject, makeThumb, getImagePath } from './gcs.js';

// Create GCS operations adapter for the Gemini client
const gcsOperations: GCSOperations = {
  putObject,
  makeThumb,
  // Adapter for getImagePath - new interface doesn't use jobId
  getImagePath: (sceneId: string, variantNum: number, isThumb: boolean) => {
    // Generate a pseudo jobId based on sceneId for backward compatibility
    const jobId = `job_${sceneId}_${Date.now()}`;
    return getImagePath(sceneId, jobId, variantNum, isThumb);
  },
};

// Initialize Gemini Image Client with GCS operations
export const geminiImageClient = new GeminiImageClient(
  env.GEMINI_API_KEY ?? 'fallback-key',
  env.RUN_MODE === 'live' ? gcsOperations : undefined // Only use real GCS in live mode
);