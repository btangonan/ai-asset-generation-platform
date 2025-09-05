import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { imagesRoutes } from './routes/images.js';
import { statusRoutes } from './routes/status.js';
import { videosRoutes } from './routes/videos.js';
import { healthRoutes } from './routes/health.js';

export async function createServer(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // Test route
  fastify.get('/test', async (request, reply) => {
    return { message: 'Server is working!' };
  });

  // Health check route
  await fastify.register(healthRoutes);

  // API routes
  await fastify.register(imagesRoutes, { prefix: '/batch' });
  await fastify.register(videosRoutes, { prefix: '/batch' });
  await fastify.register(statusRoutes);

  // Global error handler
  fastify.setErrorHandler(async (error, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.validation,
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.code || 'CLIENT_ERROR',
        message: error.message,
      });
    }

    // Internal server error
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  });
}