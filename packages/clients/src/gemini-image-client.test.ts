import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiImageClient } from './gemini-image-client.js';

describe('GeminiImageClient', () => {
  let client: GeminiImageClient;

  beforeEach(() => {
    client = new GeminiImageClient('test-api-key');
  });

  describe('generateImages', () => {
    it('should generate images with correct parameters', async () => {
      const request = {
        prompt: 'A beautiful mountain landscape',
        refPackUrls: ['https://storage.googleapis.com/test/ref1.png'],
        variants: 3,
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      const result = await client.generateImages(request);

      expect(result.images).toHaveLength(3);
      expect(result.images[0]).toHaveProperty('gcsUri');
      expect(result.images[0]).toHaveProperty('signedUrl');
      expect(result.images[0]).toHaveProperty('thumbnailUrl');
      
      // Check GCS path structure
      expect(result.images[0].gcsUri).toMatch(/gs:\/\/mock-bucket\/images\/TEST-001\/job-123\/var_1\.png/);
    });

    it('should handle different variant counts', async () => {
      const request1 = {
        prompt: 'Test prompt',
        refPackUrls: ['https://storage.googleapis.com/test/ref.png'],
        variants: 1,
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      const result1 = await client.generateImages(request1);
      expect(result1.images).toHaveLength(1);

      const request2 = { ...request1, variants: 2 };
      const result2 = await client.generateImages(request2);
      expect(result2.images).toHaveLength(2);
    });

    it('should validate input parameters', async () => {
      const invalidRequest = {
        prompt: '', // Invalid: empty prompt
        refPackUrls: ['https://storage.googleapis.com/test/ref.png'],
        variants: 3,
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      await expect(client.generateImages(invalidRequest)).rejects.toThrow();
    });

    it('should reject invalid variant counts', async () => {
      const invalidRequest = {
        prompt: 'Test prompt',
        refPackUrls: ['https://storage.googleapis.com/test/ref.png'],
        variants: 5, // Invalid: > 3
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      await expect(client.generateImages(invalidRequest)).rejects.toThrow();
    });

    it('should handle too many reference URLs', async () => {
      const invalidRequest = {
        prompt: 'Test prompt',
        refPackUrls: Array(11).fill('https://storage.googleapis.com/test/ref.png'), // > 10
        variants: 2,
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      await expect(client.generateImages(invalidRequest)).rejects.toThrow();
    });

    it('should return usage information', async () => {
      const request = {
        prompt: 'Test prompt',
        refPackUrls: ['https://storage.googleapis.com/test/ref.png'],
        variants: 2,
        sceneId: 'TEST-001',
        jobId: 'job-123',
      };

      const result = await client.generateImages(request);
      
      expect(result.usage).toBeDefined();
      expect(result.usage?.inputTokens).toBeTypeOf('number');
    });
  });

  describe('healthCheck', () => {
    it('should return true for Phase 1 (always healthy)', async () => {
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should calculate correct cost per variant', () => {
      expect(GeminiImageClient.estimateCost(1)).toBe(0.002);
      expect(GeminiImageClient.estimateCost(2)).toBe(0.004);
      expect(GeminiImageClient.estimateCost(3)).toBe(0.006);
    });

    it('should handle zero variants', () => {
      expect(GeminiImageClient.estimateCost(0)).toBe(0);
    });
  });
});