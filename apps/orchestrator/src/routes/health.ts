import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { Storage } from '@google-cloud/storage';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const storage = new Storage({
    projectId: env.GOOGLE_CLOUD_PROJECT,
  });
  const bucket = storage.bucket(env.GCS_BUCKET);
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ai-asset-orchestrator',
      version: '1.0.0',
    });
  });

  fastify.get('/readiness', async (_request, reply) => {
    const checks: Record<string, string> = {};
    let isReady = true;
    
    // Check GCS connectivity and signed URL generation
    try {
      const testFile = bucket.file('readiness-check.txt');
      const [signedUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 1000, // 1 minute
      });
      checks.gcs = signedUrl ? 'healthy' : 'degraded';
    } catch (error) {
      logger.error({ error }, 'GCS readiness check failed');
      checks.gcs = 'unhealthy';
      isReady = false;
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    checks.memory = heapPercent > 90 ? 'critical' : heapPercent > 75 ? 'warning' : 'healthy';
    if (heapPercent > 95) isReady = false;
    
    // Check Sharp library
    try {
      const sharp = await import('sharp');
      const info = sharp.default.versions;
      checks.sharp = info ? 'healthy' : 'degraded';
    } catch (error) {
      checks.sharp = 'unhealthy';
      isReady = false;
    }
    
    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        memory: {
          heapUsedMB,
          heapTotalMB,
          heapPercent,
        },
      },
    });
  });
  
  fastify.get('/metrics', async (_request, reply) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return reply.status(200).send({
      timestamp: new Date().toISOString(),
      process: {
        uptime: Math.round(process.uptime()),
        pid: process.pid,
        version: process.version,
      },
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      cpu: {
        userMs: Math.round(cpuUsage.user / 1000),
        systemMs: Math.round(cpuUsage.system / 1000),
      },
    });
  });
}