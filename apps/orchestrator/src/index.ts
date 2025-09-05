// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createServer } from './server.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';

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

  // Register routes
  await app.register(createServer);

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