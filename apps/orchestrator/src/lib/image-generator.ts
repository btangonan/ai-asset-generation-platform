import sharp from 'sharp';
import { putObject } from './gcs.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { GeminiImageClient } from '@ai-platform/clients';
import type { ReferenceMode } from '@ai-platform/shared';

// GCS operations implementation for the client
const gcsOperations = {
  putObject: async (buffer: Buffer, contentType: string, path: string) => {
    return await putObject(buffer, contentType, path);
  },
  
  makeThumb: async (buffer: Buffer) => {
    return await sharp(buffer)
      .resize(128, 128, { fit: 'cover' })
      .png()
      .toBuffer();
  },
  
  getImagePath: (sceneId: string, variantNum: number, isThumb: boolean) => {
    return isThumb
      ? `images/${sceneId}/variant_${variantNum}_thumb.png`
      : `images/${sceneId}/variant_${variantNum}.png`;
  },
};

// Initialize Gemini client with GCS operations
const geminiClient = new GeminiImageClient(
  env.GEMINI_API_KEY ?? 'fallback-key',
  gcsOperations
);

/**
 * Generate and upload images with reference support
 */
export async function generateAndUploadImages(
  sceneId: string,
  prompt: string,
  variants: number,
  referenceImages?: string[],
  referenceMode?: ReferenceMode
): Promise<Array<{ url: string; thumbnailUrl?: string }>> {
  try {
    logger.info({ 
      sceneId, 
      prompt: prompt.substring(0, 50), 
      variants,
      referenceCount: referenceImages?.length ?? 0,
      referenceMode 
    }, 'Starting image generation');

    // Check if we should use real Gemini API or return empty for dry run
    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'test-api-key' || env.RUN_MODE !== 'live') {
      logger.info({ sceneId }, 'Dry run mode - skipping actual generation');
      // Return placeholder URLs for dry run
      return Array.from({ length: variants }, (_, i) => ({
        url: `https://placeholder.com/${sceneId}/variant_${i + 1}.png`,
        thumbnailUrl: `https://placeholder.com/${sceneId}/variant_${i + 1}_thumb.png`,
      }));
    }

    // Generate images using the new client
    const params: any = {
      sceneId,
      prompt,
      variants,
    };
    
    if (referenceImages) {
      params.referenceImages = referenceImages;
    }
    
    if (referenceMode) {
      params.referenceMode = referenceMode;
    }
    
    const result = await geminiClient.generateImages(params);

    // Map results to expected format
    const mappedImages: Array<{ url: string; thumbnailUrl?: string }> = [];
    for (const img of result.images) {
      const mapped: { url: string; thumbnailUrl?: string } = { url: img.signedUrl };
      if (img.thumbnailUrl) {
        mapped.thumbnailUrl = img.thumbnailUrl;
      }
      mappedImages.push(mapped);
    }
    return mappedImages;

  } catch (error) {
    logger.error({ error, sceneId }, 'Failed to generate images');
    throw error;
  }
}

/**
 * Legacy function for backward compatibility - generates single image without references
 * @deprecated Use generateAndUploadImages instead
 */
export async function generateAndUploadImage(
  sceneId: string,
  prompt: string,
  variant: number
): Promise<{ url: string; thumbnailUrl?: string }> {
  const results = await generateAndUploadImages(sceneId, prompt, 1);
  return results[0] || { url: '', thumbnailUrl: '' };
}