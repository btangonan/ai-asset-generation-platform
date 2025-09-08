import { describe, it, expect } from 'vitest';
import {
  ImageBatchRequestSchema,
  VideoBatchRequestSchema,
  ImageBatchItemSchema,
  VideoBatchItemSchema,
  SheetRowSchema,
} from './schemas.js';

describe('Schemas', () => {
  describe('ImageBatchItemSchema', () => {
    const validImageItem = {
      scene_id: 'TEST-001',
      prompt: 'A beautiful landscape with mountains and lakes',
      ref_pack_public_urls: [{
        url: 'https://storage.googleapis.com/test-bucket/refs/landscape'
      }],
      variants: 3,
    };

    it('should accept valid image batch item', () => {
      const result = ImageBatchItemSchema.parse(validImageItem);
      expect(result).toEqual({
        ...validImageItem,
        ref_pack_public_urls: [{
          url: 'https://storage.googleapis.com/test-bucket/refs/landscape',
          mode: 'style_only'  // Default value added by Zod
        }],
        reference_mode: 'style_only'  // Default value added by Zod
      });
    });

    it('should reject empty scene_id', () => {
      const invalidItem = { ...validImageItem, scene_id: '' };
      expect(() => ImageBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject scene_id longer than 50 characters', () => {
      const invalidItem = { ...validImageItem, scene_id: 'a'.repeat(51) };
      expect(() => ImageBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject empty prompt', () => {
      const invalidItem = { ...validImageItem, prompt: '' };
      expect(() => ImageBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject prompt longer than 1000 characters', () => {
      const invalidItem = { ...validImageItem, prompt: 'a'.repeat(1001) };
      expect(() => ImageBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject invalid URL', () => {
      const invalidItem = { ...validImageItem, ref_pack_public_urls: [{ url: 'not-a-url' }] };
      expect(() => ImageBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject variants outside 1-3 range', () => {
      expect(() => ImageBatchItemSchema.parse({ ...validImageItem, variants: 0 })).toThrow();
      expect(() => ImageBatchItemSchema.parse({ ...validImageItem, variants: 4 })).toThrow();
    });
  });

  describe('ImageBatchRequestSchema', () => {
    const validRequest = {
      items: [
        {
          scene_id: 'TEST-001',
          prompt: 'Test prompt',
          ref_pack_public_urls: [{
            url: 'https://storage.googleapis.com/test/refs'
          }],
          variants: 2,
        },
      ],
      runMode: 'dry_run' as const,
    };

    it('should accept valid request', () => {
      const result = ImageBatchRequestSchema.parse(validRequest);
      expect(result.runMode).toBe('dry_run');
      expect(result.items).toHaveLength(1);
    });

    it('should default runMode to dry_run', () => {
      const requestWithoutMode = { items: validRequest.items };
      const result = ImageBatchRequestSchema.parse(requestWithoutMode);
      expect(result.runMode).toBe('dry_run');
    });

    it('should reject empty items array', () => {
      const invalidRequest = { ...validRequest, items: [] };
      expect(() => ImageBatchRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject more than 10 items', () => {
      const invalidRequest = {
        ...validRequest,
        items: Array(11).fill(validRequest.items[0]),
      };
      expect(() => ImageBatchRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('VideoBatchItemSchema', () => {
    const validVideoItem = {
      scene_id: 'VIDEO-001',
      prompt: 'Transform this image into a dynamic video',
      approved_image_url: 'https://storage.googleapis.com/test/approved/seed.png',
      veo_model: 'veo3_fast' as const,
      aspect: '16:9' as const,
      resolution: 720 as const,
      duration_s: 8 as const,
      fps: 24 as const,
    };

    it('should accept valid video item', () => {
      const result = VideoBatchItemSchema.parse(validVideoItem);
      expect(result).toEqual(validVideoItem);
    });

    it('should reject invalid veo_model', () => {
      const invalidItem = { ...validVideoItem, veo_model: 'invalid-model' };
      expect(() => VideoBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject invalid aspect ratio', () => {
      const invalidItem = { ...validVideoItem, aspect: '4:3' };
      expect(() => VideoBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject invalid resolution', () => {
      const invalidItem = { ...validVideoItem, resolution: 480 };
      expect(() => VideoBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject non-8 duration', () => {
      const invalidItem = { ...validVideoItem, duration_s: 10 };
      expect(() => VideoBatchItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject non-24 fps', () => {
      const invalidItem = { ...validVideoItem, fps: 30 };
      expect(() => VideoBatchItemSchema.parse(invalidItem)).toThrow();
    });
  });

  describe('VideoBatchRequestSchema', () => {
    const validVideoRequest = {
      items: [
        {
          scene_id: 'VIDEO-001',
          prompt: 'Test video prompt',
          approved_image_url: 'https://storage.googleapis.com/test/approved.png',
          veo_model: 'veo3_fast' as const,
          aspect: '16:9' as const,
          resolution: 720 as const,
          duration_s: 8 as const,
          fps: 24 as const,
        },
      ],
      runMode: 'dry_run' as const,
      confirmCount: 1,
    };

    it('should accept valid video request', () => {
      const result = VideoBatchRequestSchema.parse(validVideoRequest);
      expect(result.confirmCount).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should require confirmCount', () => {
      const invalidRequest = { ...validVideoRequest };
      delete (invalidRequest as any).confirmCount;
      expect(() => VideoBatchRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('SheetRowSchema', () => {
    const validSheetRow = {
      scene_id: 'SHEET-001',
      mode: 'variation' as const,
      prompt: 'Test sheet row prompt',
      ref_pack_id: 'REF-001',
      ref_pack_url: 'https://drive.google.com/drive/folders/test',
      ref_pack_public_url: 'https://storage.googleapis.com/test/refs',
      status_img: 'queued' as const,
      veo_model: 'veo3_fast' as const,
      aspect: '16:9' as const,
      resolution: 720 as const,
      duration_s: 8 as const,
      fps: 24 as const,
      est_cost_video: 0,
      status_video: 'ready_to_queue' as const,
    };

    it('should accept valid sheet row', () => {
      const result = SheetRowSchema.parse(validSheetRow);
      expect(result.duration_s).toBe(8);
      expect(result.fps).toBe(24);
    });

    it('should accept optional fields as undefined', () => {
      const minimalRow = {
        ...validSheetRow,
        style_kit_id: undefined,
        nano_img_1: undefined,
        approved_image_url: undefined,
        video_url: undefined,
        job_id: undefined,
        locked_by: undefined,
      };
      
      const result = SheetRowSchema.parse(minimalRow);
      expect(result.style_kit_id).toBeUndefined();
    });

    it('should validate email format for locked_by', () => {
      const invalidRow = { ...validSheetRow, locked_by: 'invalid-email' };
      expect(() => SheetRowSchema.parse(invalidRow)).toThrow();
      
      const validRow = { ...validSheetRow, locked_by: 'user@example.com' };
      const result = SheetRowSchema.parse(validRow);
      expect(result.locked_by).toBe('user@example.com');
    });
  });
});