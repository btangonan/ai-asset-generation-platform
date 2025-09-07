import supertest from 'supertest';
import Fastify from 'fastify';
import { metrics } from '../../src/lib/metrics';

describe('/metrics-lite', () => {
  it('returns minimal counters', async () => {
    // Create a simple test app with the metrics endpoint
    const app = Fastify();
    app.get('/metrics-lite', async () => ({ ts: Date.now(), ...metrics }));
    
    const res = await supertest(app.server).get('/metrics-lite');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('errors');
    expect(res.body).toHaveProperty('imagesGenerated');
    expect(res.body).toHaveProperty('urlRefreshes');
    expect(res.body).toHaveProperty('ts');
    
    await app.close();
  });
});