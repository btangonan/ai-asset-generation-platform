import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { VideoBatchRequestSchema } from '@ai-platform/shared';

export async function videosRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.post('/videos', async (_request, reply) => {
    // Future-proofing: Stub route for Phase 2
    return reply.status(501).send({
      error: 'VIDEO_FEATURE_DISABLED',
      message: 'Video generation will be available in Phase 2',
      expectedAvailability: 'Q2 2024',
    });
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