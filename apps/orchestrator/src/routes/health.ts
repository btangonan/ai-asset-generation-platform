import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ai-asset-orchestrator',
      version: '1.0.0',
    });
  });

  fastify.get('/readiness', async (_request, reply) => {
    // Add readiness checks here (database, external services, etc.)
    return reply.status(200).send({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        // pubsub: 'healthy',
        // gcs: 'healthy',
        // gemini: 'healthy',
      },
    });
  });
}