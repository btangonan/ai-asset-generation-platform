import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

const StatusParamsSchema = z.object({
  jobId: z.string().regex(/^(job|batch)_\d+_[a-z0-9]+$/),
});

export async function statusRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get('/status/:jobId', async (request, reply) => {
    const { jobId } = StatusParamsSchema.parse(request.params);

    // TODO: Implement actual job status lookup
    // This is a placeholder that returns mock data
    const mockJobStatus = {
      jobId,
      status: 'running' as const,
      progress: 0.65,
      startedAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 60000).toISOString(),
      outputs: [],
      error: null,
    };

    fastify.log.info({ jobId }, 'Job status requested');

    return reply.status(200).send(mockJobStatus);
  });

  // Batch status endpoint
  fastify.post('/status/batch', async (request, reply) => {
    const BatchStatusSchema = z.object({
      jobIds: z.array(z.string().regex(/^(job|batch)_\d+_[a-z0-9]+$/)).max(50),
    });

    const { jobIds } = BatchStatusSchema.parse(request.body);

    // TODO: Implement batch status lookup
    const statuses = jobIds.map(jobId => ({
      jobId,
      status: 'completed' as const,
      outputs: [`https://storage.googleapis.com/example/${jobId}/var_1.png`],
      completedAt: new Date().toISOString(),
    }));

    return reply.status(200).send({ statuses });
  });
}