import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  fetchImageAsBase64, 
  ingestReferenceImages, 
  validateReferenceImages 
} from './imageIngestion.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Image Ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchImageAsBase64', () => {
    it('should fetch and convert image to base64', async () => {
      const mockImageData = Buffer.from('test-image-data');
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => key === 'content-type' ? 'image/png' : null,
        },
        arrayBuffer: async () => mockImageData.buffer,
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await fetchImageAsBase64('https://example.com/image.png');

      expect(result).toEqual({
        data: mockImageData.toString('base64'),
        mimeType: 'image/png',
        sizeBytes: mockImageData.length,
        url: 'https://example.com/image.png',
      });
    });

    it('should reject invalid URL formats', async () => {
      await expect(fetchImageAsBase64('not-a-url')).rejects.toThrow('Invalid image URL format');
    });

    it('should reject GCS URIs', async () => {
      await expect(fetchImageAsBase64('gs://bucket/image.png')).rejects.toThrow('GCS URIs');
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchImageAsBase64('https://example.com/image.png'))
        .rejects.toThrow('Failed to ingest image');
    });

    it('should reject non-image content types', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(fetchImageAsBase64('https://example.com/page.html'))
        .rejects.toThrow('Invalid content type');
    });

    it('should reject images larger than 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => key === 'content-type' ? 'image/png' : null,
        },
        arrayBuffer: async () => largeBuffer.buffer,
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(fetchImageAsBase64('https://example.com/large.png'))
        .rejects.toThrow('exceeds maximum allowed size');
    });
  });

  describe('ingestReferenceImages', () => {
    it('should ingest multiple images in parallel', async () => {
      const mockImageData = Buffer.from('test-image');
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => key === 'content-type' ? 'image/jpeg' : null,
        },
        arrayBuffer: async () => mockImageData.buffer,
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const urls = [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
      ];

      const results = await ingestReferenceImages(urls);

      expect(results).toHaveLength(3);
      expect(results[0].mimeType).toBe('image/jpeg');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle empty URL array', async () => {
      const results = await ingestReferenceImages([]);
      expect(results).toEqual([]);
    });

    it('should reject more than 6 images', async () => {
      const urls = Array.from({ length: 7 }, (_, i) => `https://example.com/${i}.jpg`);
      
      await expect(ingestReferenceImages(urls))
        .rejects.toThrow('Too many reference images');
    });

    it('should continue processing on partial failures', async () => {
      const mockImageData = Buffer.from('test-image');
      const mockSuccessResponse = {
        ok: true,
        headers: {
          get: (key: string) => key === 'content-type' ? 'image/jpeg' : null,
        },
        arrayBuffer: async () => mockImageData.buffer,
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse);

      const urls = [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
      ];

      const results = await ingestReferenceImages(urls);

      expect(results).toHaveLength(2); // Only successful ones
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateReferenceImages', () => {
    it('should validate accessible images', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/png';
            if (key === 'content-length') return '1024';
            return null;
          },
        },
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateReferenceImages([
        'https://example.com/1.png',
        'https://example.com/2.png',
      ]);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject more than 6 URLs', async () => {
      const urls = Array.from({ length: 7 }, (_, i) => `https://example.com/${i}.jpg`);
      
      const result = await validateReferenceImages(urls);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Too many reference images: 7. Maximum allowed is 6.');
    });

    it('should reject invalid URL formats', async () => {
      const result = await validateReferenceImages(['not-a-url', 'https://valid.com/image.jpg']);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL format: not-a-url');
    });

    it('should reject GCS URIs', async () => {
      const result = await validateReferenceImages(['gs://bucket/image.png']);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GCS URI must be converted to signed URL: gs://bucket/image.png');
    });

    it('should detect inaccessible URLs', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await validateReferenceImages(['https://example.com/missing.jpg']);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('URL not accessible (404)');
    });

    it('should detect oversized images', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/png';
            if (key === 'content-length') return '11000000'; // 11MB
            return null;
          },
        },
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateReferenceImages(['https://example.com/large.png']);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Image too large');
    });
  });
});