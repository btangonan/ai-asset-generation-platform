import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { createServer } from '../../src/server.js';

describe('E2E: Complete Image Generation Workflow', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(createServer);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should complete full image generation workflow', async () => {
    const testPayload = {
      items: [
        {
          scene_id: 'E2E-001',
          prompt: 'Cinematic kitchen interior with warm lighting',
          ref_pack_public_url: 'https://storage.googleapis.com/test-bucket/refs/kitchen-pack',
          variants: 2,
        },
        {
          scene_id: 'E2E-002',
          prompt: 'Modern living room with natural light',
          ref_pack_public_url: 'https://storage.googleapis.com/test-bucket/refs/living-pack',
          variants: 3,
        },
      ],
      runMode: 'dry_run' as const,
    };

    // Step 1: Dry run to check cost
    const dryRunResponse = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: testPayload,
    });

    expect(dryRunResponse.statusCode).toBe(200);
    
    const dryRunData = JSON.parse(dryRunResponse.body);
    expect(dryRunData.runMode).toBe('dry_run');
    expect(dryRunData.estimatedCost).toBe(0.010); // (2 + 3) * $0.002
    expect(dryRunData.items).toHaveLength(2);

    // Step 2: Live run to actually generate images
    const livePayload = { ...testPayload, runMode: 'live' as const };
    
    const liveResponse = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: livePayload,
    });

    expect(liveResponse.statusCode).toBe(202);
    
    const liveData = JSON.parse(liveResponse.body);
    expect(liveData.runMode).toBe('live');
    expect(liveData.batchId).toBeDefined();
    expect(liveData.accepted).toBe(2);
    expect(liveData.jobs).toHaveLength(2);

    // Step 3: Check job status
    const jobId = liveData.jobs[0].jobId;
    
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/status/${jobId}`,
    });

    expect(statusResponse.statusCode).toBe(200);
    
    const statusData = JSON.parse(statusResponse.body);
    expect(statusData.jobId).toBe(jobId);
    expect(statusData.status).toBeDefined();

    // Step 4: Batch status check
    const batchStatusResponse = await app.inject({
      method: 'POST',
      url: '/status/batch',
      payload: {
        jobIds: liveData.jobs.map((job: any) => job.jobId),
      },
    });

    expect(batchStatusResponse.statusCode).toBe(200);
    
    const batchStatusData = JSON.parse(batchStatusResponse.body);
    expect(batchStatusData.statuses).toHaveLength(2);
  });

  it('should handle error scenarios gracefully', async () => {
    // Test with invalid data
    const invalidPayload = {
      items: [
        {
          scene_id: '', // Invalid: too short
          prompt: 'Test prompt',
          ref_pack_public_url: 'invalid-url', // Invalid URL
          variants: 5, // Invalid: too many variants
        },
      ],
      runMode: 'live',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: invalidPayload,
    });

    expect(response.statusCode).toBe(400);
    
    const data = JSON.parse(response.body);
    expect(data.type).toBeDefined();
  });

  it('should enforce rate limiting across requests', async () => {
    const testPayload = {
      items: [
        {
          scene_id: 'RATE-001',
          prompt: 'Rate limit test',
          ref_pack_public_url: 'https://storage.googleapis.com/test-bucket/refs/test',
          variants: 1,
        },
      ],
      runMode: 'live' as const,
    };

    // First request should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: testPayload,
    });

    expect(response1.statusCode).toBe(202);

    // Second request should be rate limited  
    const response2 = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: { ...testPayload, items: [{ ...testPayload.items[0], scene_id: 'RATE-002' }] },
    });

    expect(response2.statusCode).toBe(429);
  });
});