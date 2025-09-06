import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { CostCalculator } from '../lib/cost.js';
import { generateJobId } from '../lib/idempotency.js';
import { google } from 'googleapis';
import { logger } from '../lib/logger.js';
import { updateSheetRow } from '../lib/sheets.js';
import { generateAndUploadImage } from '../lib/image-generator.js';
import { sendProblemDetails, Problems } from '../lib/problem-details.js';

const sheets = google.sheets('v4');

const SheetBatchRequestSchema = z.object({
  runMode: z.enum(['dry_run', 'live']),
  rowFilter: z.object({
    status: z.enum(['pending', 'completed', 'error', 'running', 'all']).optional().default('all'),
    limit: z.number().min(1).max(100).optional().default(10)
  }).optional().default({ status: 'all', limit: 10 })
});

export async function sheetsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const costCalculator = new CostCalculator();

  fastify.post('/sheets', async (request, reply) => {
    // Get sheet ID from header
    const sheetId = request.headers['x-sheet-id'] as string;
    if (!sheetId) {
      return sendProblemDetails(reply, {
        type: 'https://api.ai-platform.com/problems/missing-header',
        title: 'Missing Required Header',
        status: 400,
        detail: 'x-sheet-id header is required'
      });
    }

    // Parse request body
    const result = SheetBatchRequestSchema.safeParse(request.body);
    if (!result.success) {
      return sendProblemDetails(reply, Problems.invalidRequestSchema(
        'Invalid request body for sheet processing',
        result.error.issues
      ));
    }

    const { runMode, rowFilter } = result.data;
    
    try {
      // Authenticate with Google Sheets
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const authClient = await auth.getClient();
      
      // Read the sheet
      logger.info({ sheetId }, 'Reading Google Sheet');
      const response = await sheets.spreadsheets.values.get({
        auth: authClient as any,
        spreadsheetId: sheetId,
        range: 'Sheet1!A:Z', // Read all columns
      });
      
      const rows = response.data.values || [];
      if (rows.length === 0) {
        return sendProblemDetails(reply, {
          type: 'https://api.ai-platform.com/problems/empty-sheet',
          title: 'Empty Sheet',
          status: 400,
          detail: 'Sheet is empty. Please add headers and data.'
        });
      }
      
      // Get headers from first row
      const headers = rows[0] || [];
      const requiredHeaders = ['scene_id', 'prompt'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        return sendProblemDetails(reply, {
          type: 'https://api.ai-platform.com/problems/missing-headers',
          title: 'Missing Required Headers',
          status: 400,
          detail: `Sheet is missing required headers: ${missingHeaders.join(', ')}`,
          hint: 'First row must contain: scene_id, prompt, variants, status_img, nano_img_1, nano_img_2, nano_img_3, job_id, error_msg, cost',
          missingHeaders
        });
      }
      
      // Get column indices
      const sceneIdCol = headers.indexOf('scene_id');
      const promptCol = headers.indexOf('prompt');
      const variantsCol = headers.indexOf('variants');
      const statusCol = headers.indexOf('status_img');
      
      // Process data rows
      const dataRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const sceneId = row[sceneIdCol];
        const prompt = row[promptCol];
        const status = statusCol >= 0 ? row[statusCol] : 'pending';
        const variants = variantsCol >= 0 ? parseInt(row[variantsCol]) || 1 : 1;
        
        // Skip if no scene_id or prompt
        if (!sceneId || !prompt) continue;
        
        // Apply status filter
        if (rowFilter.status !== 'all') {
          // For 'pending', match both empty status and 'pending' status
          if (rowFilter.status === 'pending' && status !== 'pending' && status !== '') {
            continue;
          }
          // For other specific statuses, exact match required
          if (rowFilter.status !== 'pending' && status !== rowFilter.status) {
            continue;
          }
        }
        
        dataRows.push({
          rowIndex: i + 1, // 1-based row index for Sheet
          scene_id: sceneId,
          prompt: prompt,
          variants: Math.min(Math.max(variants, 1), 3), // Clamp between 1-3
          currentStatus: status
        });
        
        if (dataRows.length >= rowFilter.limit) break;
      }
      
      if (dataRows.length === 0) {
        return reply.status(200).send({
          message: 'No rows to process',
          totalRows: rows.length - 1,
          filter: rowFilter
        });
      }
      
      // Calculate cost
      const items = dataRows.map(r => ({
        scene_id: r.scene_id,
        prompt: r.prompt,
        variants: r.variants
      }));
      const estimatedCost = costCalculator.estimateImageBatch(items);
      
      // Generate batch ID
      const batchId = generateJobId('sheet', items);
      
      logger.info({
        sheetId,
        rowsToProcess: dataRows.length,
        estimatedCost,
        runMode
      }, 'Processing sheet batch');
      
      // Dry run mode - just return what would be processed
      if (runMode === 'dry_run') {
        return reply.status(200).send({
          batchId,
          runMode: 'dry_run',
          sheetId,
          estimatedCost,
          message: 'Dry run completed - no images generated',
          rowsToProcess: dataRows.map(r => ({
            row: r.rowIndex,
            scene_id: r.scene_id,
            prompt: r.prompt.substring(0, 50) + (r.prompt.length > 50 ? '...' : ''),
            variants: r.variants,
            currentStatus: r.currentStatus
          }))
        });
      }
      
      // Live mode - process images and update sheet
      const results = [];
      
      for (const row of dataRows) {
        try {
          // Update status to 'running'
          await updateSheetRow(sheetId, row.scene_id, {
            status_img: 'running',
            job_id: batchId
          });
          
          // Generate images
          const imageUrls = [];
          for (let i = 0; i < row.variants; i++) {
            const imageResult = await generateAndUploadImage(
              row.scene_id,
              row.prompt,
              i + 1
            );
            imageUrls.push(imageResult.url);
          }
          
          // Calculate actual cost for this row (variants * cost per image)
          const rowCost = costCalculator.estimateImageBatch([{
            scene_id: row.scene_id,
            prompt: row.prompt,
            variants: row.variants
          }]);
          
          // Update sheet with results
          const updateData: any = {
            status_img: 'completed',
            cost: `$${rowCost.toFixed(4)}`
          };
          
          if (imageUrls[0]) updateData.nano_img_1 = imageUrls[0];
          if (imageUrls[1]) updateData.nano_img_2 = imageUrls[1];
          if (imageUrls[2]) updateData.nano_img_3 = imageUrls[2];
          
          await updateSheetRow(sheetId, row.scene_id, updateData);
          
          results.push({
            scene_id: row.scene_id,
            status: 'completed',
            images: imageUrls
          });
          
        } catch (error: any) {
          logger.error({ error, row }, 'Failed to process row');
          
          // Update sheet with error
          await updateSheetRow(sheetId, row.scene_id, {
            status_img: 'error',
            error_msg: error.message || 'Unknown error'
          });
          
          results.push({
            scene_id: row.scene_id,
            status: 'error',
            error: error.message
          });
        }
      }
      
      return reply.status(200).send({
        batchId,
        runMode: 'live',
        sheetId,
        totalCost: estimatedCost,
        processed: results.length,
        results
      });
      
    } catch (error: any) {
      logger.error({ error, sheetId }, 'Failed to process sheet');
      
      if (error.code === 403) {
        return sendProblemDetails(reply, {
          ...Problems.permissionDenied('Cannot access the Google Sheet. Please ensure the service account has access.'),
          serviceAccount: 'orchestrator-sa@solid-study-467023-i3.iam.gserviceaccount.com',
          hint: 'Share your sheet with the service account email above as an Editor'
        });
      }
      
      if (error.code === 404) {
        return sendProblemDetails(reply, Problems.sheetNotFound(sheetId));
      }
      
      return sendProblemDetails(reply, Problems.internalError(error.message || 'Failed to process sheet'));
    }
  });
}