import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { VideoBatchRequestSchema } from '@ai-platform/shared';
import { sendProblemDetails, Problems } from '../lib/problem-details.js';

export async function videosRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.post('/videos', async (_request, reply) => {
    // Future-proofing: Stub route for Phase 2
    return sendProblemDetails(reply, Problems.notImplemented('Video generation (Phase 2)'));
  });

  // Keep the schema validation ready for Phase 2
  fastify.addHook('preHandler', async (request, _reply) => {
    if (request.routeOptions.url === '/videos' && request.method === 'POST') {
      // Parse and validate schema (but don't use it yet)
      try {
        VideoBatchRequestSchema.parse(request.body);
      } catch (error) {
        fastify.log.debug(error, 'Video schema validation (future-proofing)');
        // Don't throw - just log for future compatibility
      }
    }
  });
}