import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiImageClient } from './geminiImageClient.js';
import type { GCSOperations } from './geminiImageClient.js';
import type { GenerateImagesParams } from '@ai-platform/shared';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

// Mock the image ingestion module
vi.mock('./imageIngestion.js', () => ({
  ingestReferenceImages: vi.fn().mockResolvedValue([
    {
      data: 'base64-reference-image-1',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      url: 'https://example.com/ref1.jpg',
    },
    {
      data: 'base64-reference-image-2',
      mimeType: 'image/png',
      sizeBytes: 2048,
      url: 'https://example.com/ref2.png',
    },
  ]),
}));

describe('GeminiImageClient', () => {
  let client: GeminiImageClient;
  let mockGcsOps: GCSOperations;
  let mockGenerateContent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock GCS operations
    mockGcsOps = {
      putObject: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/path/image.png',
        signedUrl: 'https://storage.googleapis.com/signed-url',
      }),
      makeThumb: vi.fn().mockResolvedValue(Buffer.from('thumbnail-data')),
      getImagePath: vi.fn().mockImplementation((sceneId, variantNum, isThumb) => 
        isThumb 
          ? `images/${sceneId}/variant_${variantNum}_thumb.png`
          : `images/${sceneId}/variant_${variantNum}.png`
      ),
    };

    // Create mock generateContent function
    mockGenerateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64-generated-image-data',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    // Set up the client with mocked dependencies
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    }));

    client = new GeminiImageClient('test-api-key', mockGcsOps);
  });

  describe('generateImages', () => {
    it('should generate images without references', async () => {
      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'A beautiful landscape',
        variants: 2,
      };

      const result = await client.generateImages(params);

      expect(result.sceneId).toBe('test-scene');
      expect(result.images).toHaveLength(2);
      expect(result.images[0].variantNumber).toBe(1);
      expect(result.images[1].variantNumber).toBe(2);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.referenceImagesUsed).toEqual([]);

      // Verify Gemini was called with text-only prompt
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGenerateContent).toHaveBeenCalledWith([
        { text: 'A beautiful landscape' },
      ]);
    });

    it('should generate images with reference images in style_only mode', async () => {
      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'A futuristic city',
        variants: 1,
        referenceImages: [
          'https://example.com/ref1.jpg',
          'https://example.com/ref2.png',
        ],
        referenceMode: 'style_only',
      };

      const result = await client.generateImages(params);

      expect(result.images).toHaveLength(1);
      expect(result.referenceImagesUsed).toEqual([
        'https://example.com/ref1.jpg',
        'https://example.com/ref2.png',
      ]);

      // Verify Gemini was called with multimodal prompt
      expect(mockGenerateContent).toHaveBeenCalledWith([
        {
          text: 'Use these reference images for style and aesthetic guidance only. Generate a completely new composition.\n\nReference images provided: 2',
        },
        {
          inlineData: {
            data: 'base64-reference-image-1',
            mimeType: 'image/jpeg',
          },
        },
        {
          inlineData: {
            data: 'base64-reference-image-2',
            mimeType: 'image/png',
          },
        },
        {
          text: '\nNow generate an image based on this prompt: A futuristic city',
        },
      ]);
    });

    it('should generate images with reference images in style_and_composition mode', async () => {
      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'Similar composition with different colors',
        variants: 1,
        referenceImages: ['https://example.com/ref.jpg'],
        referenceMode: 'style_and_composition',
      };

      const result = await client.generateImages(params);

      expect(result.images).toHaveLength(1);

      // Verify the composition mode instruction was used
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs[0].text).toContain('both style and compositional guidance');
    });

    it('should handle multiple variants with references', async () => {
      const params: GenerateImagesParams = {
        sceneId: 'multi-variant',
        prompt: 'Abstract art',
        variants: 3,
        referenceImages: ['https://example.com/style.jpg'],
      };

      const result = await client.generateImages(params);

      expect(result.images).toHaveLength(3);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
      expect(mockGcsOps.putObject).toHaveBeenCalledTimes(6); // 3 images + 3 thumbnails

      // Verify each variant has correct number
      expect(result.images[0].variantNumber).toBe(1);
      expect(result.images[1].variantNumber).toBe(2);
      expect(result.images[2].variantNumber).toBe(3);
    });

    it('should handle Gemini API failures gracefully', async () => {
      // Make Gemini fail
      mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));

      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'Test prompt',
        variants: 1,
      };

      const result = await client.generateImages(params);

      // Should still return a result with placeholder
      expect(result.images).toHaveLength(1);
      expect(result.error).toBeUndefined(); // Individual variant errors are logged, not returned
    });

    it('should throw error if GCS operations not configured', async () => {
      const clientWithoutGcs = new GeminiImageClient('test-api-key');

      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'Test prompt',
        variants: 1,
      };

      await expect(clientWithoutGcs.generateImages(params))
        .rejects.toThrow('GCS operations not configured');
    });

    it('should validate input parameters', async () => {
      const invalidParams = {
        sceneId: '', // Invalid: empty string
        prompt: 'Test',
        variants: 1,
      } as GenerateImagesParams;

      await expect(client.generateImages(invalidParams))
        .rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      // First call fails with 429, second succeeds
      mockGenerateContent
        .mockRejectedValueOnce({ message: '429 Too Many Requests' })
        .mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: 'base64-image-after-retry',
                        mimeType: 'image/png',
                      },
                    },
                  ],
                },
              },
            ],
          },
        });

      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'Test prompt',
        variants: 1,
      };

      const result = await client.generateImages(params);

      expect(result.images).toHaveLength(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should include metadata in generated images', async () => {
      const params: GenerateImagesParams = {
        sceneId: 'test-scene',
        prompt: 'Test prompt',
        variants: 1,
      };

      const result = await client.generateImages(params);

      expect(result.images[0].metadata).toEqual({
        width: 1024,
        height: 1024,
        sizeBytes: expect.any(Number),
        mimeType: 'image/png',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: { candidates: [] },
      });

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly', () => {
      expect(GeminiImageClient.estimateCost(1)).toBe(0.002);
      expect(GeminiImageClient.estimateCost(3)).toBe(0.006);
      expect(GeminiImageClient.estimateCost(10)).toBe(0.02);
    });
  });
});