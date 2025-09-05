import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { createServer } from '../../src/server.js';

describe('E2E: Health Endpoints', () => {
  let app: ReturnType<typeof Fastify>;
  let serverAddress: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(createServer);
    
    serverAddress = await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should return healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('ai-asset-orchestrator');
    expect(data.timestamp).toBeDefined();
  });

  it('should return readiness status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/readiness',
    });

    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.status).toBe('ready');
    expect(data.checks).toBeDefined();
  });
});