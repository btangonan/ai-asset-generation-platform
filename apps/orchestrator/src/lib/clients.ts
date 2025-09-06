import { GeminiImageClient, type GCSOperations } from '@ai-platform/clients';
import { env } from './env.js';
import { putObject, makeThumb, getImagePath, downloadUrl } from './gcs.js';

// Create GCS operations adapter for the Gemini client
const gcsOperations: GCSOperations = {
  putObject,
  makeThumb,
  getImagePath,
  downloadUrl,
};

// Initialize Gemini Image Client with GCS operations
export const geminiImageClient = new GeminiImageClient(
  env.GEMINI_API_KEY ?? 'fallback-key',
  env.RUN_MODE === 'live' ? gcsOperations : undefined // Only use real GCS in live mode
);