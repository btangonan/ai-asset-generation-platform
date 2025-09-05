import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { env } from './env.js';
import { logger } from './logger.js';

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
    
    await file.save(finalBuffer, {
      metadata: {
        contentType: finalContentType,
        cacheControl: 'public, max-age=7776000', // 90 days
      },
      resumable: false, // For files < 10MB
    });

    const signedUrl = await generateSignedUrl(gcsPath);
    
    return {
      gcsUri: `gs://${env.GCS_BUCKET}/${gcsPath}`,
      signedUrl,
    };
  } catch (error) {
    logger.error({ error, gcsPath }, 'Failed to upload to GCS');
    throw new Error(`GCS upload failed: ${error.message}`);
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
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  }
}

/**
 * Generate a signed URL for a GCS object
 * TEMPORARY: Using public URLs for MVP testing
 */
export async function generateSignedUrl(
  gcsPath: string,
  options: { expiresInDays?: number } = {}
): Promise<string> {
  const { expiresInDays = 7 } = options;
  const file = bucket.file(gcsPath);
  
  try {
    // TEMPORARY: For MVP testing, return public URL instead of signed URL
    // This requires the bucket to have public read access or the files to be public
    // In production, we'll use proper service account credentials for signed URLs
    logger.info({ gcsPath }, 'Using public URL for MVP testing (signed URLs require service account)');
    
    // Make the file public temporarily for testing
    try {
      await file.makePublic();
    } catch (err) {
      logger.warn({ error: err, gcsPath }, 'Could not make file public, continuing anyway');
    }
    
    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET}/${gcsPath}`;
    return publicUrl;
    
    // Original signed URL code - will restore when we have service account credentials
    // const [signedUrl] = await file.getSignedUrl({
    //   version: 'v4',
    //   action: 'read',
    //   expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    // });
    // return signedUrl;
  } catch (error) {
    logger.error({ error, gcsPath }, 'Failed to generate URL');
    // For MVP, return public URL as fallback
    return `https://storage.googleapis.com/${env.GCS_BUCKET}/${gcsPath}`;
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
    throw new Error(`URL download failed: ${error.message}`);
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