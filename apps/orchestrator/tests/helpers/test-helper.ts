import { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';
import Fastify from 'fastify';

export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false // Disable logging during tests for cleaner output
  });

  // Register the server routes
  await app.register(createServer);

  await app.ready();
  
  return app;
}

export function createMaliciousPayload(overrides: any = {}) {
  return {
    items: [{
      scene_id: 'test-scene',
      prompt: 'test prompt',
      variants: 1,
      ...overrides
    }],
    runMode: 'dry_run'
  };
}

export function expectNoCrash(response: any) {
  // Should not return 500 (server crash)
  expect(response.statusCode).not.toBe(500);
  
  // Should return a valid response structure
  if (response.statusCode >= 400) {
    const error = response.json();
    expect(error).toHaveProperty('error');
    expect(error).toHaveProperty('message');
  }
}

export function expectValidResponse(response: any) {
  // Should not crash
  expect(response.statusCode).not.toBe(500);
  
  // Should return valid structure for successful responses
  if (response.statusCode === 200) {
    const result = response.json();
    expect(result).toHaveProperty('batchId'); // API returns batchId, not job_id
    expect(typeof result.batchId).toBe('string');
    expect(result.batchId.length).toBeGreaterThan(0);
  }
}