import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { imagesRoutes } from '../../src/routes/images.js';

describe('Contract Tests: API Input Validation', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(imagesRoutes, { prefix: '/batch' });
  });

  describe('Image Batch Schema Validation', () => {
    const validImagePayload = {
      items: [
        {
          scene_id: 'TEST-001',
          prompt: 'A beautiful sunset over mountains',
          ref_pack_public_url: 'https://storage.googleapis.com/test-bucket/refs/pack1',
          variants: 3,
        },
      ],
      runMode: 'dry_run' as const,
    };

    it('should accept valid image batch request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: validImagePayload,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.runMode).toBe('dry_run');
      expect(data.estimatedCost).toBeDefined();
    });

    describe('Scene ID Validation', () => {
      it('should reject empty scene_id', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            scene_id: '',
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should reject scene_id too long (>50 chars)', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            scene_id: 'a'.repeat(51),
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });
    });

    describe('Prompt Validation', () => {
      it('should reject empty prompt', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            prompt: '',
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should reject prompt too long (>1000 chars)', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            prompt: 'a'.repeat(1001),
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });
    });

    describe('URL Validation', () => {
      it('should reject invalid ref_pack_public_url', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            ref_pack_public_url: 'not-a-url',
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });
    });

    describe('Variants Validation', () => {
      it('should reject variants < 1', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            variants: 0,
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should reject variants > 3', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            variants: 4,
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should reject non-integer variants', async () => {
        const payload = {
          ...validImagePayload,
          items: [{
            ...validImagePayload.items[0],
            variants: 2.5,
          }],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });
    });

    describe('Batch Size Validation', () => {
      it('should reject empty items array', async () => {
        const payload = {
          ...validImagePayload,
          items: [],
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should reject > 10 items in batch', async () => {
        const payload = {
          ...validImagePayload,
          items: Array(11).fill(validImagePayload.items[0]),
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });
    });

    describe('Run Mode Validation', () => {
      it('should accept dry_run mode', async () => {
        const payload = {
          ...validImagePayload,
          runMode: 'dry_run' as const,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(200);
      });

      it('should accept live mode', async () => {
        const payload = {
          ...validImagePayload,
          runMode: 'live' as const,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(202);
      });

      it('should reject invalid run mode', async () => {
        const payload = {
          ...validImagePayload,
          runMode: 'invalid_mode',
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const data = JSON.parse(response.body);
        expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
      });

      it('should default to dry_run when runMode omitted', async () => {
        const payload = {
          items: validImagePayload.items,
          // runMode omitted
        };

        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          payload,
        });

        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.runMode).toBe('dry_run');
      });
    });
  });

  describe('Video Fields Validation (Future-Proofed)', () => {
    // Test that video-related fields return 400 even though videos are disabled in Phase 1
    // This ensures our schema is ready for Phase 2

    it('should reject request with video batch item fields', async () => {
      const videoPayload = {
        items: [
          {
            scene_id: 'VIDEO-001',
            prompt: 'A video prompt',
            approved_image_url: 'https://storage.googleapis.com/test/image.png',
            veo_model: 'veo3_fast',
            aspect: '16:9',
            resolution: 720,
            duration_s: 8,
            fps: 24,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: videoPayload,
      });

      // Should return 400 because this doesn't match ImageBatchItemSchema
      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject bad veo_model values', async () => {
      const badVideoPayload = {
        items: [
          {
            scene_id: 'VIDEO-001',
            prompt: 'A video prompt',
            approved_image_url: 'https://storage.googleapis.com/test/image.png',
            veo_model: 'invalid_model',
            aspect: '16:9',
            resolution: 720,
            duration_s: 8,
            fps: 24,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: badVideoPayload,
      });

      // Should return 400 because this doesn't match ImageBatchItemSchema
      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject bad aspect ratio values', async () => {
      const badAspectPayload = {
        items: [
          {
            scene_id: 'VIDEO-001',
            prompt: 'A video prompt',
            approved_image_url: 'https://storage.googleapis.com/test/image.png',
            veo_model: 'veo3',
            aspect: '4:3', // Invalid aspect (not 16:9 or 9:16)
            resolution: 720,
            duration_s: 8,
            fps: 24,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: badAspectPayload,
      });

      // Should return 400 because this doesn't match ImageBatchItemSchema
      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject bad resolution values', async () => {
      const badResolutionPayload = {
        items: [
          {
            scene_id: 'VIDEO-001',
            prompt: 'A video prompt',
            approved_image_url: 'https://storage.googleapis.com/test/image.png',
            veo_model: 'veo3',
            aspect: '16:9',
            resolution: 480, // Invalid resolution (not 720 or 1080)
            duration_s: 8,
            fps: 24,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: badResolutionPayload,
      });

      // Should return 400 because this doesn't match ImageBatchItemSchema
      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });
  });

  describe('Missing Required Fields', () => {
    it('should reject request missing scene_id', async () => {
      const payload = {
        items: [
          {
            // scene_id missing
            prompt: 'Test prompt',
            ref_pack_public_url: 'https://storage.googleapis.com/test/pack',
            variants: 2,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject request missing items array', async () => {
      const payload = {
        // items missing
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });
  });
});