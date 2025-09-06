import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { imagesRoutes } from './routes/images.js';
import { statusRoutes } from './routes/status.js';
import { videosRoutes } from './routes/videos.js';
import { healthRoutes } from './routes/health.js';
import { sheetsRoutes } from './routes/sheets.js';
import { sendProblemDetails, Problems } from './lib/problem-details.js';
import { authenticateRequest, validateAuthConfiguration } from './lib/auth.js';
import { env } from './lib/env.js';

export async function createServer(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // Validate authentication configuration on startup
  if (env.NODE_ENV !== 'test') {
    const authConfig = validateAuthConfiguration();
    if (!authConfig.valid) {
      fastify.log.error({ errors: authConfig.errors }, 'Authentication configuration invalid');
      throw new Error(`Authentication setup failed: ${authConfig.errors.join(', ')}`);
    }
    fastify.log.info('Authentication configuration validated successfully');
  }

  // Global authentication middleware (runs before all routes)
  fastify.addHook('preHandler', authenticateRequest);

  // Test route
  fastify.get('/test', async (request, reply) => {
    return { message: 'Server is working!' };
  });

  // Health check route
  await fastify.register(healthRoutes);

  // API routes
  await fastify.register(imagesRoutes, { prefix: '/batch' });
  await fastify.register(videosRoutes, { prefix: '/batch' });
  await fastify.register(sheetsRoutes, { prefix: '/batch' });
  await fastify.register(statusRoutes);

  // Global error handler
  fastify.setErrorHandler(async (error, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return sendProblemDetails(reply, {
        type: 'https://api.ai-platform.com/problems/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid request data',
        validationErrors: error.validation,
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return sendProblemDetails(reply, {
        type: 'https://api.ai-platform.com/problems/client-error',
        title: error.code || 'Client Error',
        status: error.statusCode,
        detail: error.message,
      });
    }

    // Internal server error
    return sendProblemDetails(reply, Problems.internalError('An unexpected error occurred'));
  });
}