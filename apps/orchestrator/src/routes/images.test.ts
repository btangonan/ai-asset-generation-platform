import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { imagesRoutes } from './images.js';

describe('Images Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(imagesRoutes, { prefix: '/batch' });
  });

  describe('POST /batch/images', () => {
    const validPayload = {
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

    it('should accept valid dry run request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data.runMode).toBe('dry_run');
      expect(data.estimatedCost).toBe(0.006); // 3 variants * $0.002
      expect(data.message).toContain('Dry run completed');
    });

    it('should accept valid live request', async () => {
      const livePayload = { ...validPayload, runMode: 'live' as const };
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: livePayload,
      });

      expect(response.statusCode).toBe(202);
      
      const data = JSON.parse(response.body);
      expect(data.runMode).toBe('live');
      expect(data.accepted).toBe(1);
      expect(data.jobs).toHaveLength(1);
    });

    it('should reject batch size exceeding limit', async () => {
      const oversizedPayload = {
        items: Array(11).fill(validPayload.items[0]), // 11 > MAX_ROWS_PER_BATCH
        runMode: 'dry_run' as const,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: oversizedPayload,
      });

      expect(response.statusCode).toBe(400);
      
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject invalid variants count', async () => {
      const invalidPayload = {
        items: [
          {
            ...validPayload.items[0],
            variants: 5, // > MAX_VARIANTS_PER_ROW (also > 3 which is Zod max)
          },
        ],
        runMode: 'dry_run' as const,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: invalidPayload,
      });

      expect(response.statusCode).toBe(400);
      
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should reject malformed schema', async () => {
      const invalidPayload = {
        items: [
          {
            scene_id: '',  // Too short
            prompt: 'Test',
            // Missing ref_pack_public_url
            variants: 3,
          },
        ],
        runMode: 'dry_run',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: invalidPayload,
      });

      expect(response.statusCode).toBe(400);
      
      const data = JSON.parse(response.body);
      expect(data.error).toBe('INVALID_REQUEST_SCHEMA');
    });

    it('should bypass rate limiting in test mode', async () => {
      // Both requests should succeed since rate limiting is disabled in tests
      const response1 = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: { ...validPayload, runMode: 'live' },
      });
      
      expect(response1.statusCode).toBe(202);

      const response2 = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: { ...validPayload, runMode: 'live' },
      });

      expect(response2.statusCode).toBe(202);
      
      const data = JSON.parse(response2.body);
      expect(data.runMode).toBe('live');
      expect(data.accepted).toBe(1);
    });
  });
});