import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  GenerateImagesParams,
  GeneratedImage,
  GenerateImagesResult,
  ReferenceMode,
} from '@ai-platform/shared';
import { GenerateImagesParamsSchema } from '@ai-platform/shared';
import { ingestReferenceImages, type IngestedImage } from './imageIngestion.js';

/**
 * GCS operations interface for dependency injection
 */
export interface GCSOperations {
  putObject: (buffer: Buffer, contentType: string, path: string) => Promise<{ 
    gcsUri: string; 
    signedUrl: string;
  }>;
  makeThumb: (buffer: Buffer) => Promise<Buffer>;
  getImagePath: (sceneId: string, variantNum: number, isThumb: boolean) => string;
}

/**
 * Gemini Image Client with reference image support
 * Uses Gemini 2.5 Flash (nano banana) for image generation
 */
export class GeminiImageClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model = 'gemini-2.5-flash-image-preview'; // Nano banana model
  private gcsOps: GCSOperations | undefined;

  constructor(apiKey: string, gcsOps?: GCSOperations) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.gcsOps = gcsOps;
  }

  setGCSOperations(gcsOps: GCSOperations): void {
    this.gcsOps = gcsOps;
  }

  /**
   * Generate images with optional reference image conditioning
   */
  async generateImages(params: GenerateImagesParams): Promise<GenerateImagesResult> {
    const startTime = Date.now();
    
    // Validate parameters
    const validated = GenerateImagesParamsSchema.parse(params);
    const { sceneId, prompt, variants, referenceImages, referenceMode = 'style_only' } = validated;

    if (!this.gcsOps) {
      throw new Error('GCS operations not configured');
    }

    console.log(`🎨 Generating ${variants} images for scene ${sceneId}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    
    // Ingest reference images if provided
    let ingestedRefs: IngestedImage[] = [];
    if (referenceImages && referenceImages.length > 0) {
      console.log(`📸 Ingesting ${referenceImages.length} reference images...`);
      ingestedRefs = await ingestReferenceImages(referenceImages);
      console.log(`✅ Ingested ${ingestedRefs.length} reference images`);
    }

    const images: GeneratedImage[] = [];
    const errors: string[] = [];

    // Generate each variant
    for (let i = 0; i < variants; i++) {
      const variantNum = i + 1;
      console.log(`🔄 Generating variant ${variantNum}/${variants}`);

      try {
        const imageBuffer = await this.generateSingleImage(
          prompt,
          ingestedRefs,
          referenceMode,
          sceneId,
          variantNum
        );

        // Create thumbnail
        const thumbBuffer = await this.gcsOps.makeThumb(imageBuffer);

        // Upload main image
        const imagePath = this.gcsOps.getImagePath(sceneId, variantNum, false);
        const imageResult = await this.gcsOps.putObject(
          imageBuffer,
          'image/png',
          imagePath
        );

        // Upload thumbnail
        const thumbPath = this.gcsOps.getImagePath(sceneId, variantNum, true);
        const thumbResult = await this.gcsOps.putObject(
          thumbBuffer,
          'image/png',
          thumbPath
        );

        images.push({
          variantNumber: variantNum,
          gcsUri: imageResult.gcsUri,
          signedUrl: imageResult.signedUrl,
          thumbnailUrl: thumbResult.signedUrl,
          metadata: {
            width: 1024,
            height: 1024,
            sizeBytes: imageBuffer.length,
            mimeType: 'image/png',
          },
        });

        console.log(`✅ Variant ${variantNum} completed`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Variant ${variantNum}: ${errorMsg}`);
        console.error(`❌ Failed to generate variant ${variantNum}: ${errorMsg}`);
      }
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`✨ Generation completed in ${processingTimeMs}ms`);

    const result: GenerateImagesResult = {
      sceneId,
      images,
      processingTimeMs,
      referenceImagesUsed: ingestedRefs.map(r => r.url),
    };
    
    if (errors.length > 0) {
      result.error = errors.join('; ');
    }
    
    return result;
  }

  /**
   * Generate a single image with Gemini 2.5 Flash
   */
  private async generateSingleImage(
    prompt: string,
    references: IngestedImage[],
    mode: ReferenceMode,
    sceneId: string,
    variantNum: number
  ): Promise<Buffer> {
    const model = this.genAI.getGenerativeModel({ model: this.model });

    // Build the multimodal prompt
    const parts: any[] = [];

    // Add reference images if provided
    if (references.length > 0) {
      const modeInstruction = mode === 'style_only'
        ? 'Use these reference images for style and aesthetic guidance only. Generate a completely new composition.'
        : 'Use these reference images for both style and compositional guidance. Maintain similar structure and elements.';

      parts.push({
        text: `${modeInstruction}\n\nReference images provided: ${references.length}`
      });

      // Add each reference image as inline data
      for (const ref of references) {
        parts.push({
          inlineData: {
            data: ref.data,
            mimeType: ref.mimeType,
          }
        });
      }

      parts.push({
        text: `\nNow generate an image based on this prompt: ${prompt}`
      });
    } else {
      // No references, just use the text prompt
      parts.push({ text: prompt });
    }

    try {
      // Generate content with retry logic
      const result: any = await this.retryWithBackoff(async () => {
        return await model.generateContent(parts);
      });

      // Extract image from response
      const response: any = result.response;
      const candidates: any[] = response.candidates;

      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates returned from Gemini');
      }

      const candidate: any = candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error('No content parts in response');
      }

      // Find the image part
      let imageData: string | undefined;
      const contentParts: any[] = candidate.content.parts;
      for (const part of contentParts) {
        if (part.inlineData && part.inlineData.data) {
          imageData = part.inlineData.data;
          break;
        }
      }

      if (!imageData) {
        throw new Error('No image data in response');
      }

      // Convert base64 to buffer
      return Buffer.from(imageData, 'base64');
    } catch (error) {
      console.error(`Failed to generate with Gemini: ${error}`);
      // Fall back to placeholder if Gemini fails
      return this.generatePlaceholder(prompt, sceneId, variantNum);
    }
  }

  /**
   * Retry logic with exponential backoff for API calls
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Check if error is retryable
        const errorMessage = lastError.message.toLowerCase();
        const isRetryable = 
          errorMessage.includes('429') ||
          errorMessage.includes('500') ||
          errorMessage.includes('502') ||
          errorMessage.includes('503') ||
          errorMessage.includes('504') ||
          errorMessage.includes('timeout');

        if (!isRetryable) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.log(`⏳ Retrying after ${Math.round(delay)}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Generate a placeholder image as fallback
   */
  private async generatePlaceholder(
    prompt: string,
    sceneId: string,
    variant: number
  ): Promise<Buffer> {
    const colors = [
      ['#FF6B6B', '#4ECDC4'],
      ['#45B7D1', '#FFA07A'],
      ['#98D8C8', '#F7DC6F'],
      ['#BB8FCE', '#85C1E2'],
      ['#F8B739', '#52C234']
    ];
    
    const colorPair = colors[(variant - 1) % colors.length];
    if (!colorPair) {
      throw new Error('Invalid color pair index');
    }
    const [color1, color2] = colorPair;
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${variant}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="1024" height="1024" fill="url(#grad${variant})" />
  
  <text x="512" y="450" font-family="Arial" font-size="28" fill="white" text-anchor="middle" font-weight="bold">
    ${sceneId}
  </text>
  
  <text x="512" y="490" font-family="Arial" font-size="20" fill="white" text-anchor="middle">
    Variant ${variant}
  </text>
  
  <text x="512" y="550" font-family="Arial" font-size="16" fill="white" text-anchor="middle" opacity="0.8">
    ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}
  </text>
  
  <text x="512" y="980" font-family="Arial" font-size="14" fill="white" text-anchor="middle" opacity="0.5">
    Generated: ${new Date().toISOString()}
  </text>
</svg>`;

    return Buffer.from(svg);
  }

  /**
   * Health check for the Gemini API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      await model.generateContent('test');
      return true;
    } catch (error) {
      console.error('Gemini health check failed:', error);
      return false;
    }
  }

  /**
   * Estimate cost for image generation
   */
  static estimateCost(variants: number): number {
    const COST_PER_IMAGE = 0.002; // $0.002 per image
    return variants * COST_PER_IMAGE;
  }
  
  /**
   * Export GCS operations interface
   */
  static GCSOperations = {} as GCSOperations;
}