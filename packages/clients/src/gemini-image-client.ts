import { z } from 'zod';
import crypto from 'crypto';

// Request/Response schemas
const GenerateImagesRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  refPackUrls: z.array(z.string().url()).max(6).optional().default([]),
  variants: z.number().int().min(1).max(3),
  sceneId: z.string(),
  jobId: z.string(),
});

const GenerateImagesResponseSchema = z.object({
  images: z.array(z.object({
    gcsUri: z.string(),
    signedUrl: z.string().url(),
    thumbnailUrl: z.string().url(),
  })),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
  }).optional(),
});

export type GenerateImagesRequest = z.infer<typeof GenerateImagesRequestSchema>;
export type GenerateImagesResponse = z.infer<typeof GenerateImagesResponseSchema>;

// GCS operations interface for dependency injection
export interface GCSOperations {
  putObject: (buffer: Buffer, contentType: string, path: string) => Promise<{ gcsUri: string; signedUrl: string }>;
  makeThumb: (buffer: Buffer) => Promise<Buffer>;
  getImagePath: (sceneId: string, jobId: string, variantNum: number, isThumb: boolean) => string;
  downloadUrl: (url: string) => Promise<Buffer>;
}

export class GeminiImageClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly model = 'gemini-1.5-flash'; // Using available model
  private gcsOps: GCSOperations | undefined;

  constructor(apiKey: string, gcsOps?: GCSOperations) {
    this.apiKey = apiKey;
    this.gcsOps = gcsOps;
  }

  setGCSOperations(gcsOps: GCSOperations): void {
    this.gcsOps = gcsOps;
  }

  async generateImages(request: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    const validatedRequest = GenerateImagesRequestSchema.parse(request);
    const { prompt, refPackUrls, variants, sceneId, jobId } = validatedRequest;
    
    // If GCS operations are not provided, return error
    if (!this.gcsOps) {
      throw new Error('GCS operations not configured');
    }
    
    console.log(`🎨 Starting image generation for scene ${sceneId}, job ${jobId}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`🔢 Generating ${variants} variant(s)`);
    
    try {
      const images = [];
      
      // Generate placeholder images for each variant
      // In production, this would call a real image generation API
      for (let i = 0; i < variants; i++) {
        const variantNum = i + 1;
        console.log(`  📸 Generating variant ${variantNum}/${variants}`);
        
        // Generate a unique placeholder image with metadata
        const imageBuffer = await this.generatePlaceholderImage(prompt, sceneId, variantNum);
        
        // Generate thumbnail
        console.log(`  🔧 Creating thumbnail for variant ${variantNum}`);
        const thumbBuffer = await this.gcsOps.makeThumb(imageBuffer);
        
        // Upload full image to GCS
        const imagePath = this.gcsOps.getImagePath(sceneId, jobId, variantNum, false);
        console.log(`  ☁️ Uploading image to GCS: ${imagePath}`);
        const imageResult = await this.gcsOps.putObject(
          imageBuffer,
          'image/png',
          imagePath
        );
        
        // Upload thumbnail to GCS
        const thumbPath = this.gcsOps.getImagePath(sceneId, jobId, variantNum, true);
        console.log(`  ☁️ Uploading thumbnail to GCS: ${thumbPath}`);
        const thumbResult = await this.gcsOps.putObject(
          thumbBuffer,
          'image/png',
          thumbPath
        );
        
        images.push({
          gcsUri: imageResult.gcsUri,
          signedUrl: imageResult.signedUrl,
          thumbnailUrl: thumbResult.signedUrl,
        });
        
        console.log(`  ✅ Variant ${variantNum} completed`);
      }
      
      console.log(`✨ Successfully generated ${variants} image(s) for scene ${sceneId}`);
      
      return {
        images,
        usage: {
          inputTokens: prompt.length * 2, // Rough estimate
          outputTokens: 0,
        },
      };
    } catch (error: any) {
      console.error(`❌ Image generation failed for scene ${sceneId}:`, error.message);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate a placeholder image with embedded metadata
   * In production, this would be replaced with actual image generation API calls
   */
  private async generatePlaceholderImage(prompt: string, sceneId: string, variant: number): Promise<Buffer> {
    // Create a deterministic but unique color based on prompt and variant
    const hash = crypto.createHash('sha256').update(`${prompt}${sceneId}${variant}`).digest('hex');
    const r = parseInt(hash.substr(0, 2), 16);
    const g = parseInt(hash.substr(2, 2), 16);
    const b = parseInt(hash.substr(4, 2), 16);
    
    // Generate SVG with metadata
    const timestamp = new Date().toISOString();
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg${variant}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(${r},${g},${b});stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(${255-r},${255-g},${255-b});stop-opacity:1" />
    </linearGradient>
    <pattern id="grid${variant}" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M 64 0 L 0 0 0 64" fill="none" stroke="white" stroke-width="0.5" opacity="0.3"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg${variant})" />
  <rect width="1024" height="1024" fill="url(#grid${variant})" />
  
  <!-- Center circle -->
  <circle cx="512" cy="512" r="300" fill="white" opacity="0.9"/>
  
  <!-- Text -->
  <text x="512" y="300" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#333">
    AI Generated Image
  </text>
  
  <text x="512" y="400" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#666">
    Scene: ${sceneId}
  </text>
  
  <text x="512" y="450" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#666">
    Variant: ${variant}
  </text>
  
  <text x="512" y="550" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#999">
    ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}
  </text>
  
  <text x="512" y="700" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#ccc">
    ${timestamp}
  </text>
  
  <!-- Decorative elements -->
  <rect x="312" y="600" width="400" height="2" fill="#ddd"/>
  <rect x="312" y="350" width="400" height="2" fill="#ddd"/>
  
  <!-- Corner markers -->
  <g opacity="0.5">
    <rect x="20" y="20" width="60" height="2" fill="#333"/>
    <rect x="20" y="20" width="2" height="60" fill="#333"/>
    
    <rect x="944" y="20" width="60" height="2" fill="#333"/>
    <rect x="1002" y="20" width="2" height="60" fill="#333"/>
    
    <rect x="20" y="1002" width="60" height="2" fill="#333"/>
    <rect x="20" y="944" width="2" height="60" fill="#333"/>
    
    <rect x="944" y="1002" width="60" height="2" fill="#333"/>
    <rect x="1002" y="944" width="2" height="60" fill="#333"/>
  </g>
</svg>`;

    // Convert SVG to PNG using sharp (will be done by the GCS operations)
    // For now, return the SVG as a buffer
    // In a real implementation, we'd convert this to PNG
    // But since we have sharp in the pipeline, we can pass SVG and let it convert
    return Buffer.from(svg);
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models/${this.model}?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ Gemini client health check failed:', error);
      return false;
    }
  }

  // Utility method to estimate cost
  static estimateCost(variants: number): number {
    const COST_PER_IMAGE = 0.002; // $0.002 per image as per plan
    return variants * COST_PER_IMAGE;
  }
}