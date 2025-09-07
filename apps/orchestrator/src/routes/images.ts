import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ImageBatchRequestSchema } from '@ai-platform/shared';
import { env } from '../lib/env.js';
import { validateRateLimit } from '../lib/rate-limit.js';
import { CostCalculator } from '../lib/cost.js';
import { generateJobId, checkJobExists, storeJobId } from '../lib/idempotency.js';
import { publishImageJobBatch, type ImageJobMessage } from '../lib/pubsub.js';
import { sendProblemDetails, Problems } from '../lib/problem-details.js';
import { mergeRefs } from '../lib/ref-merge.js';
import { saveState, type JobState } from '../lib/ledger.js';
import { refreshForLongBatch } from '../lib/url-refresh.js';
import { checkBudget, recordSpend } from '../lib/budget-guard.js';
import { appendLedger } from '../lib/budget-ledger.js';
import { metrics } from '../lib/metrics.js';

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
    
    // Budget guard check (only for live mode)
    if (runMode === 'live') {
      const budgetCheck = checkBudget(userId, estimatedCost);
      if (!budgetCheck.allowed) {
        return sendProblemDetails(reply, {
          type: 'https://example.com/problems/budget-exceeded',
          title: 'Budget Exceeded',
          status: 402,
          detail: budgetCheck.message || 'Daily budget limit exceeded',
          instance: `/batch/images/${batchId}`,
          code: budgetCheck.code,
          estimatedCost,
          remaining: budgetCheck.remaining,
          dailyLimit: budgetCheck.dailyLimit,
        });
      }
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
    const batchStartTime = Date.now();
    
    // Store job ID for deduplication
    await storeJobId(batchId, {
      userId,
      items,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Initialize job state in ledger
    const jobState: JobState = {
      batchId,
      status: 'running',
      progress: 0,
      items: items.map(item => ({
        sceneId: item.scene_id,
        status: 'pending',
      })),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveState(batchId, jobState);

    // Import necessary modules for direct generation
    const { generateAndUploadImages } = await import('../lib/image-generator.js');
    const { updateSheetRow } = await import('../lib/sheets.js');
    
    const jobs: any[] = [];
    const results: any[] = [];
    
    // Process each item directly
    for (const [index, item] of items.entries()) {
      const jobId = `${batchId}_${item.scene_id}_${index}`;
      
      try {
        fastify.log.info({ 
          jobId, 
          sceneId: item.scene_id,
          referenceCount: item.ref_pack_public_urls?.length ?? 0,
          referenceMode: item.reference_mode
        }, 'Generating images directly');
        
        // Update sheet status to "running" if sheet ID provided
        if (sheetId !== 'default-sheet') {
          try {
            await updateSheetRow(sheetId, item.scene_id, { status_img: 'running' });
          } catch (err) {
            fastify.log.warn({ error: err, sheetId, sceneId: item.scene_id }, 'Failed to update sheet status');
          }
        }
        
        // Refresh reference URLs if batch is taking long
        let refreshedRefs: string[] | undefined;
        if (item.ref_pack_public_urls && item.ref_pack_public_urls.length > 0) {
          const urlsToRefresh = item.ref_pack_public_urls.map(ref => ({
            url: ref.url,
            gcsUri: ref.url.includes('storage.googleapis.com') 
              ? `gs://${ref.url.split('/')[3]}/${ref.url.split('/').slice(4).join('/')}`
              : ref.url
          }));
          refreshedRefs = await refreshForLongBatch(batchStartTime, urlsToRefresh);
        }
        
        // Generate images with Nano Banana including reference support
        const imageResults = await generateAndUploadImages(
          item.scene_id,
          item.prompt,
          item.variants,
          refreshedRefs || item.ref_pack_public_urls?.map(ref => ref.url),
          item.reference_mode
        );
        
        // Map results to expected format
        const images = imageResults.map((result, idx) => ({
          gcsUri: `gs://${env.GCS_BUCKET}/images/${item.scene_id}/variant_${idx + 1}.png`,
          signedUrl: result.url,
          thumbnailUrl: result.thumbnailUrl
        }));
        
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

    // Record actual spend for successful generations
    const successfulJobs = jobs.filter(j => j.status === 'completed').length;
    const actualCost = successfulJobs * costCalculator.rates.gemini_image * 
                      (items[0]?.variants || 1); // Calculate based on actual successful generations
    if (actualCost > 0) {
      recordSpend(userId, actualCost);
      
      // Increment metrics counter for images generated
      const totalImages = results.reduce((sum, r) => sum + (r.images?.length || 0), 0);
      metrics.imagesGenerated += totalImages;
      
      // Append to ledger for cost tracking
      await appendLedger({
        ts: Date.now(),
        userId,
        jobId: batchId,
        prompt: items.map(i => i.prompt).join('; '),
        images: totalImages,
        cost: actualCost,
      });
    }
    
    return reply.status(200).send({
      batchId,
      runMode: 'live',
      estimatedCost,
      actualCost,
      accepted: jobs.filter(j => j.status !== 'failed').length,
      rejected: jobs.filter(j => j.status === 'failed').map(j => j.sceneId),
      jobs,
      results: results.length > 0 ? results : undefined,
    });
  });
}

