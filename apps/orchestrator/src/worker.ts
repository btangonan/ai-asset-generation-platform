#!/usr/bin/env node

import { startImageWorker } from './workers/image-worker.js';
import { logger } from './lib/logger.js';
import { env } from './lib/env.js';

/**
 * Standalone worker process for processing image generation jobs
 */
async function main() {
  logger.info({ 
    mode: env.RUN_MODE,
    project: env.GOOGLE_CLOUD_PROJECT,
    bucket: env.GCS_BUCKET,
  }, 'Starting worker process');
  
  if (env.RUN_MODE === 'dry_run') {
    logger.warn('Running in dry run mode - worker will not process real jobs');
  }
  
  try {
    await startImageWorker();
    logger.info('Worker started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    process.exit(1);
  }
}

// Start the worker
main().catch(error => {
  logger.error({ error }, 'Fatal error in worker');
  process.exit(1);
});