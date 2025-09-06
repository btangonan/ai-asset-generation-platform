import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ImageBatchRequestSchema } from '@ai-platform/shared';
import { env } from '../lib/env.js';
import { validateRateLimit } from '../lib/rate-limit.js';
import { CostCalculator } from '../lib/cost.js';
import { generateJobId, checkJobExists, storeJobId } from '../lib/idempotency.js';
import { publishImageJobBatch, type ImageJobMessage } from '../lib/pubsub.js';
import { sendProblemDetails, Problems } from '../lib/problem-details.js';

export async function imagesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const costCalculator = new CostCalculator();

  fastify.post('/images', async (request, reply) => {
    // Debug: Log what we're receiving
    fastify.log.info({ 
      bodyType: typeof request.body, 
      bodyKeys: request.body ? Object.keys(request.body) : null 
    }, 'Request body debug');
    
    const result = ImageBatchRequestSchema.safeParse(request.body);
    if (!result.success) {
      fastify.log.error({ issues: result.error.issues }, 'Schema validation failed');
      return sendProblemDetails(reply, Problems.invalidRequestSchema(
        'Request does not match expected schema',
        result.error.issues
      ));
    }
    const body = result.data;
    const { items, runMode } = body;

    // Validate batch size
    if (items.length > env.MAX_ROWS_PER_BATCH) {
      return sendProblemDetails(reply, Problems.batchSizeExceeded(env.MAX_ROWS_PER_BATCH));
    }

    // Validate variants per row
    const invalidRows = items.filter(item => 
      item.variants > env.MAX_VARIANTS_PER_ROW || item.variants < 1
    );
    if (invalidRows.length > 0) {
      return sendProblemDetails(reply, Problems.invalidVariants(
        1, 
        env.MAX_VARIANTS_PER_ROW, 
        invalidRows.map(r => r.scene_id)
      ));
    }

    // Rate limiting check (placeholder)
    const userId = 'default'; // TODO: Extract from auth
    // TEMPORARILY DISABLED FOR TESTING
    // const rateLimitResult = await validateRateLimit(userId);
    // if (!rateLimitResult.allowed) {
    //   return reply.status(429).send({
    //     error: 'RATE_LIMITED',
    //     message: `Please wait ${rateLimitResult.retryAfterMinutes} minutes`,
    //   });
    // }

    // Cost estimation
    const estimatedCost = costCalculator.estimateImageBatch(items);
    fastify.log.info({
      batchSize: items.length,
      estimatedCost,
      runMode,
    }, 'Processing image batch');

    // Generate deterministic batch ID for idempotency
    const batchId = generateJobId(userId, items);
    
    // Check if this job already exists (idempotency)
    const exists = await checkJobExists(batchId);
    if (exists) {
      return reply.status(200).send({
        batchId,
        runMode,
        estimatedCost,
        message: 'Job already exists (idempotent request)',
        cached: true,
      });
    }
    
    // Dry run mode
    if (runMode === 'dry_run') {
      return reply.status(200).send({
        batchId,
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

    // Live mode - generate images directly (bypassing Pub/Sub for MVP testing)
    const sheetId = request.headers['x-sheet-id'] as string || 'default-sheet';
    const timestamp = Date.now();
    
    // Store job ID for deduplication
    await storeJobId(batchId, {
      userId,
      items,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Import necessary modules for direct generation
    const { generateAndUploadImage } = await import('../lib/image-generator.js');
    const { updateSheetRow } = await import('../lib/sheets.js');
    
    const jobs: any[] = [];
    const results: any[] = [];
    
    // Process each item directly
    for (const [index, item] of items.entries()) {
      const jobId = `${batchId}_${item.scene_id}_${index}`;
      
      try {
        fastify.log.info({ jobId, sceneId: item.scene_id }, 'Generating images directly');
        
        // Update sheet status to "running" if sheet ID provided
        if (sheetId !== 'default-sheet') {
          try {
            await updateSheetRow(sheetId, item.scene_id, { status_img: 'running' });
          } catch (err) {
            fastify.log.warn({ error: err, sheetId, sceneId: item.scene_id }, 'Failed to update sheet status');
          }
        }
        
        // Generate images with Nano Banana
        const images = [];
        for (let v = 1; v <= item.variants; v++) {
          const imageResult = await generateAndUploadImage(
            item.scene_id,
            item.prompt,
            v
          );
          images.push({
            gcsUri: `gs://${env.GCS_BUCKET}/images/${item.scene_id}/variant_${v}.png`,
            signedUrl: imageResult.url,
            thumbnailUrl: imageResult.thumbnailUrl
          });
        }
        
        const result = { images };
        fastify.log.info({ jobId, imageCount: images.length }, 'Images generated successfully');
        
        // Update sheet with results if sheet ID provided
        if (sheetId !== 'default-sheet' && result.images) {
          try {
            const updateData: any = {
              status_img: 'awaiting_review',
            };
            
            // Add image URLs to appropriate columns
            if (result.images.length > 0 && result.images[0]) {
              updateData.nano_img_1 = result.images[0].signedUrl;
            }
            if (result.images.length > 1 && result.images[1]) {
              updateData.nano_img_2 = result.images[1].signedUrl;
            }
            if (result.images.length > 2 && result.images[2]) {
              updateData.nano_img_3 = result.images[2].signedUrl;
            }
            
            await updateSheetRow(sheetId, item.scene_id, updateData);
          } catch (err) {
            fastify.log.warn({ error: err, sheetId, sceneId: item.scene_id }, 'Failed to update sheet with results');
          }
        }
        
        jobs.push({
          jobId,
          sceneId: item.scene_id,
          status: 'completed',
        });
        
        results.push({
          sceneId: item.scene_id,
          images: result.images,
        });
        
      } catch (error: any) {
        fastify.log.error({ error: error.message, jobId, sceneId: item.scene_id }, 'Failed to generate images');
        
        jobs.push({
          jobId,
          sceneId: item.scene_id,
          status: 'failed',
          error: error.message,
        });
        
        // Update sheet status to failed if sheet ID provided
        if (sheetId !== 'default-sheet') {
          try {
            await updateSheetRow(sheetId, item.scene_id, { 
              status_img: 'error',
              error_msg: error.message 
            });
          } catch (err) {
            fastify.log.warn({ error: err, sheetId, sceneId: item.scene_id }, 'Failed to update sheet error status');
          }
        }
      }
    }

    return reply.status(200).send({
      batchId,
      runMode: 'live',
      estimatedCost,
      accepted: jobs.filter(j => j.status !== 'failed').length,
      rejected: jobs.filter(j => j.status === 'failed').map(j => j.sceneId),
      jobs,
      results: results.length > 0 ? results : undefined,
    });
  });
}

