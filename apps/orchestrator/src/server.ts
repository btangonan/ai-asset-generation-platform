import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { imagesRoutes } from './routes/images.js';
import { statusRoutes } from './routes/status.js';
import { videosRoutes } from './routes/videos.js';
import { healthRoutes } from './routes/health.js';
import { sheetsRoutes } from './routes/sheets.js';
import { uploadRoutes } from './routes/upload.js';
import { sendProblemDetails, Problems } from './lib/problem-details.js';
import { authenticateRequest, initAuth } from './lib/auth.js';
import { env } from './lib/env.js';

export async function createServer(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // Initialize authentication with graceful degradation
  if (env.NODE_ENV !== 'test') {
    const authStatus = initAuth();
    if (authStatus.warnings.length > 0) {
      fastify.log.warn({ warnings: authStatus.warnings }, 'Authentication warnings detected');
    }
    if (authStatus.enabled) {
      fastify.log.info('Authentication enabled successfully');
    } else {
      fastify.log.warn('Authentication disabled - running without API key validation');
    }
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
  await fastify.register(uploadRoutes);
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