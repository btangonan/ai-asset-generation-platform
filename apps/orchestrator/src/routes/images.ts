import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ImageBatchRequestSchema } from '@ai-platform/shared';
import { env } from '../lib/env.js';
import { validateRateLimit } from '../lib/rate-limit.js';
import { CostCalculator } from '../lib/cost.js';

export async function imagesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const costCalculator = new CostCalculator();

  fastify.post('/images', async (request, reply) => {
    let body;
    try {
      body = ImageBatchRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST_SCHEMA',
        message: 'Request does not match expected schema',
      });
    }
    const { items, runMode } = body;

    // Validate batch size
    if (items.length > env.MAX_ROWS_PER_BATCH) {
      return reply.status(400).send({
        error: 'BATCH_SIZE_EXCEEDED',
        message: `Maximum ${env.MAX_ROWS_PER_BATCH} rows per batch`,
      });
    }

    // Validate variants per row
    const invalidRows = items.filter(item => 
      item.variants > env.MAX_VARIANTS_PER_ROW || item.variants < 1
    );
    if (invalidRows.length > 0) {
      return reply.status(400).send({
        error: 'INVALID_VARIANTS',
        message: `Variants must be between 1 and ${env.MAX_VARIANTS_PER_ROW}`,
        invalidRows: invalidRows.map(r => r.scene_id),
      });
    }

    // Rate limiting check (placeholder)
    const userId = 'default'; // TODO: Extract from auth
    const rateLimitResult = await validateRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return reply.status(429).send({
        error: 'RATE_LIMITED',
        message: `Please wait ${rateLimitResult.retryAfterMinutes} minutes`,
      });
    }

    // Cost estimation
    const estimatedCost = costCalculator.estimateImageBatch(items);
    fastify.log.info({
      batchSize: items.length,
      estimatedCost,
      runMode,
    }, 'Processing image batch');

    // Dry run mode
    if (runMode === 'dry_run') {
      return reply.status(200).send({
        batchId: generateBatchId(),
        runMode: 'dry_run',
        estimatedCost,
        message: 'Dry run completed - no images generated',
        items: items.map(item => ({
          scene_id: item.scene_id,
          variants: item.variants,
          estimatedCost: item.variants * costCalculator.rates.gemini_image,
        })),
      });
    }

    // Live mode - enqueue jobs
    const batchId = generateBatchId();
    const jobs = items.map(item => ({
      jobId: generateJobId(),
      sceneId: item.scene_id,
      status: 'queued' as const,
    }));

    // TODO: Enqueue to Pub/Sub
    fastify.log.info({ batchId, jobCount: jobs.length }, 'Enqueued image jobs');

    return reply.status(202).send({
      batchId,
      runMode: 'live',
      estimatedCost,
      accepted: jobs.length,
      rejected: [],
      jobs,
    });
  });
}

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}