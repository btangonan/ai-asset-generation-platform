import { z } from 'zod';

// Request/Response schemas
const GenerateImagesRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  refPackUrls: z.array(z.string().url()).max(10),
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

export class GeminiImageClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImages(request: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    const validatedRequest = GenerateImagesRequestSchema.parse(request);
    
    // Phase 1: Mock implementation for scaffolding
    // Phase 2: Replace with actual Gemini API calls
    const mockImages = Array.from({ length: validatedRequest.variants }, (_, i) => ({
      gcsUri: `gs://mock-bucket/images/${validatedRequest.sceneId}/${validatedRequest.jobId}/var_${i + 1}.png`,
      signedUrl: `https://storage.googleapis.com/mock-bucket/images/${validatedRequest.sceneId}/${validatedRequest.jobId}/var_${i + 1}.png?X-Goog-Signature=mock`,
      thumbnailUrl: `https://storage.googleapis.com/mock-bucket/images/${validatedRequest.sceneId}/${validatedRequest.jobId}/thumb_${i + 1}.png?X-Goog-Signature=mock`,
    }));

    // Simulate API delay - shorter for tests
    const delay = process.env.NODE_ENV === 'test' ? 100 : (1000 + Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`🎨 [MOCK] Generated ${validatedRequest.variants} images for scene ${validatedRequest.sceneId}`);
    console.log(`📝 Prompt: ${validatedRequest.prompt.substring(0, 100)}...`);
    console.log(`📁 Reference images: ${validatedRequest.refPackUrls.length} files`);

    return GenerateImagesResponseSchema.parse({
      images: mockImages,
      usage: {
        inputTokens: 150,
        outputTokens: 0,
      },
    });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Phase 1: Always return true (mock)
      // Phase 2: Make a minimal API call to verify connectivity
      return true;
    } catch (error) {
      console.error('Gemini Image client health check failed:', error);
      return false;
    }
  }

  // Utility method to estimate cost
  static estimateCost(variants: number): number {
    const COST_PER_IMAGE = 0.002; // $0.002 per image
    return variants * COST_PER_IMAGE;
  }
}