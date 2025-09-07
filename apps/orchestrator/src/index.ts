// Load environment variables first (development only)
import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Only load .env.local in development
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { createServer } from './server.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { startRateLimitCleanup } from './lib/rate-limit.js';
import { metrics } from './lib/metrics.js';

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        },
      }),
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Security middleware
  await app.register(helmet);
  await app.register(cors, {
    origin: true, // Configure appropriately for production
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart file upload support
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100,     // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 10 * 1024 * 1024, // 10MB max file size
      files: 6,           // Max number of file fields
      headerPairs: 2000,  // Max number of header key=>value pairs
    },
  });

  // Count every request (cheap visibility for canary)
  app.addHook('onRequest', async () => {
    metrics.requests += 1;
  });

  // Ensure errors are counted and shaped as RFC7807-ish
  app.setErrorHandler((err, req, reply) => {
    metrics.errors += 1;
    const status = reply.statusCode >= 400 ? reply.statusCode : 500;
    reply.status(status).send({
      type: 'about:blank',
      title: 'INTERNAL_ERROR',
      status,
      detail: err?.message ?? 'internal error',
      instance: req.url,
    });
  });

  // Tiny metrics surface for log-based alerts and manual inspection
  app.get('/metrics-lite', async () => ({ ts: Date.now(), ...metrics }));

  // Register routes
  await app.register(createServer);
  
  // Start rate limit cleanup
  startRateLimitCleanup();

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully`);
      try {
        await app.close();
        process.exit(0);
      } catch (error) {
        app.log.error(error, 'Error during shutdown');
        process.exit(1);
      }
    });
  });

  try {
    const address = await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    app.log.info(`🚀 Orchestrator service started on ${address}`);
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  logger.error(error, 'Failed to bootstrap application');
  process.exit(1);
});