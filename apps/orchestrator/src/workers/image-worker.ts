import { Message } from '@google-cloud/pubsub';
import { geminiImageClient } from '../lib/clients.js';
import { updateSheetRow } from '../lib/sheets.js';
import { getImageJobSubscription, type ImageJobMessage } from '../lib/pubsub.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';

/**
 * Process a single image generation job
 */
async function processImageJob(message: Message): Promise<void> {
  const startTime = Date.now();
  const data = JSON.parse(message.data.toString()) as ImageJobMessage;
  const { jobId, sceneId, sheetId, prompt, refPackUrls, variants } = data;
  
  logger.info({ jobId, sceneId }, 'Processing image job');
  
  try {
    // Update sheet status to "running"
    await updateSheetRow(sheetId, sceneId, {
      status_img: 'running',
      job_id: jobId,
    });
    
    // Generate images using Gemini client
    const result = await geminiImageClient.generateImages({
      prompt,
      refPackUrls,
      variants,
      sceneId,
      jobId,
    });
    
    // Update sheet with generated image URLs (thumbnails)
    const updates: any = {
      status_img: 'completed',
    };
    
    // Map thumbnails to nano_img columns
    result.images.forEach((image, index) => {
      if (index === 0) updates.nano_img_1 = image.thumbnailUrl;
      if (index === 1) updates.nano_img_2 = image.thumbnailUrl;
      if (index === 2) updates.nano_img_3 = image.thumbnailUrl;
    });
    
    await updateSheetRow(sheetId, sceneId, updates);
    
    // Acknowledge message (mark as processed)
    message.ack();
    
    const duration = Date.now() - startTime;
    logger.info({ jobId, sceneId, duration }, 'Image job completed successfully');
    
  } catch (error: any) {
    logger.error({ error: error.message, jobId, sceneId }, 'Image job failed');
    
    // Update sheet with error status
    await updateSheetRow(sheetId, sceneId, {
      status_img: 'error',
      error_msg: error.message.substring(0, 255),
    }).catch(err => {
      logger.error({ err, sceneId }, 'Failed to update sheet with error');
    });
    
    // Check if we should retry (based on message delivery attempts)
    const deliveryAttempt = message.deliveryAttempt || 1;
    if (deliveryAttempt < 5) {
      // Nack the message to retry with backoff
      message.nack();
      logger.info({ jobId, attempt: deliveryAttempt }, 'Message nacked for retry');
    } else {
      // Max retries reached, acknowledge to prevent infinite loop
      message.ack();
      logger.error({ jobId }, 'Max retries reached, abandoning job');
    }
  }
}

/**
 * Start the worker to process image generation jobs
 */
export async function startImageWorker(): Promise<void> {
  if (env.RUN_MODE === 'dry_run') {
    logger.info('Dry run mode - worker not starting');
    return;
  }
  
  logger.info('Starting image generation worker');
  
  try {
    const subscription = await getImageJobSubscription();
    
    // Configure message handler
    subscription.on('message', async (message: Message) => {
      try {
        await processImageJob(message);
      } catch (error) {
        logger.error({ error }, 'Unhandled error in message processing');
        message.nack();
      }
    });
    
    // Handle errors
    subscription.on('error', (error) => {
      logger.error({ error }, 'Subscription error');
    });
    
    // Configure flow control
    subscription.setOptions({
      flowControl: {
        maxMessages: 5, // Process up to 5 messages concurrently
        allowExcessMessages: false,
      },
      ackDeadline: 600, // 10 minutes per message
    });
    
    logger.info('Image worker started and listening for messages');
    
  } catch (error) {
    logger.error({ error }, 'Failed to start image worker');
    throw error;
  }
}

/**
 * Graceful shutdown
 */
export async function stopImageWorker(): Promise<void> {
  try {
    const subscription = await getImageJobSubscription();
    await subscription.close();
    logger.info('Image worker stopped');
  } catch (error) {
    logger.error({ error }, 'Error stopping image worker');
  }
}

// Handle process signals for graceful shutdown
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await stopImageWorker();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await stopImageWorker();
    process.exit(0);
  });
}