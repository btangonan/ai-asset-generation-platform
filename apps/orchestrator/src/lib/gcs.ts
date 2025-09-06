import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { env } from './env.js';
import { logger } from './logger.js';
import { withRetry, withTimeout } from './retry.js';

// Configure Sharp concurrency for resource management
const SHARP_CONCURRENCY = Number(env.SHARP_CONCURRENCY || 2);
sharp.concurrency(SHARP_CONCURRENCY);

const storage = new Storage({
  projectId: env.GOOGLE_CLOUD_PROJECT,
});

const bucket = storage.bucket(env.GCS_BUCKET);

export interface PutObjectResult {
  gcsUri: string;
  signedUrl: string;
}

/**
 * Upload a buffer to GCS and return both the canonical path and a signed URL
 * Automatically converts SVG to PNG if needed
 */
export async function putObject(
  buffer: Buffer,
  contentType: string,
  gcsPath: string
): Promise<PutObjectResult> {
  const file = bucket.file(gcsPath);
  
  try {
    // If the buffer contains SVG data, convert to PNG
    let finalBuffer = buffer;
    let finalContentType = contentType;
    
    // Check if buffer is SVG (simple check for SVG header)
    const bufferStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 100));
    if (bufferStr.includes('<?xml') || bufferStr.includes('<svg')) {
      logger.info({ gcsPath }, 'Converting SVG to PNG before upload');
      finalBuffer = await sharp(buffer)
        .png({
          quality: 90,
          compressionLevel: 6,
        })
        .toBuffer();
      finalContentType = 'image/png';
    }
    
    // Upload with retry logic
    await withRetry(
      async () => {
        await file.save(finalBuffer, {
          metadata: {
            contentType: finalContentType,
            cacheControl: 'public, max-age=7776000', // 90 days
          },
          resumable: false, // Non-resumable for files < 10MB
        });
      },
      {
        maxAttempts: 3,
        onRetry: (attempt) => {
          logger.warn({ gcsPath, attempt }, 'Retrying GCS upload');
        }
      }
    );

    const signedUrl = await generateSignedUrl(gcsPath);
    
    return {
      gcsUri: `gs://${env.GCS_BUCKET}/${gcsPath}`,
      signedUrl,
    };
  } catch (error) {
    logger.error({ error, gcsPath }, 'Failed to upload to GCS');
    throw new Error(`GCS upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a 128px thumbnail from an image buffer (supports SVG input)
 */
export async function makeThumb(buffer: Buffer): Promise<Buffer> {
  try {
    // Sharp can handle SVG input and convert to PNG
    // First convert SVG to PNG if needed, then resize
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // If it's SVG or needs conversion, ensure we're working with PNG
    return await image
      .resize(128, 128, {
        fit: 'cover',
        position: 'center',
      })
      .png({
        quality: 80,
        compressionLevel: 9,
      })
      .toBuffer();
  } catch (error) {
    logger.error({ error }, 'Failed to generate thumbnail');
    throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a signed URL for a GCS object
 * Uses V4 signed URLs with service account credentials
 */
export async function generateSignedUrl(
  gcsPath: string,
  options: { expiresInDays?: number } = {}
): Promise<string> {
  const { expiresInDays = Number(env.SIGNED_URL_DAYS || 7) } = options; // Use env variable, default to 7 days (GCS max)
  const file = bucket.file(gcsPath);
  
  try {
    // Generate V4 signed URL with very long expiry
    // This will use the service account credentials if available,
    // or impersonation if GOOGLE_AUTH_IMPERSONATE_SERVICE_ACCOUNT is set
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    });
    
    logger.info({ gcsPath, expiresInDays }, 'Generated signed URL for GCS object');
    return signedUrl;
  } catch (error) {
    logger.error({ error, gcsPath }, 'Failed to generate signed URL');
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Download a file from a public URL into a buffer
 */
export async function downloadUrl(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000), // 30s timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error({ error, url }, 'Failed to download URL');
    throw new Error(`URL download failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get canonical GCS path for an image
 */
export function getImagePath(
  sceneId: string,
  jobId: string,
  variantNum: number,
  isThumb: boolean = false
): string {
  const filename = isThumb ? `thumb_${variantNum}.png` : `var_${variantNum}.png`;
  return `images/${sceneId}/${jobId}/${filename}`;
}