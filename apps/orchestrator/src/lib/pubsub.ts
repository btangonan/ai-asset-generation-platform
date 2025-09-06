import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';
import { env } from './env.js';
import { logger } from './logger.js';

const pubsub = new PubSub({
  projectId: env.GOOGLE_CLOUD_PROJECT,
});

// Topic and subscription names
const IMAGE_GENERATION_TOPIC = 'image-generation-jobs';
const IMAGE_GENERATION_SUBSCRIPTION = 'image-generation-worker';

export interface ImageJobMessage {
  jobId: string;
  batchId: string;
  sceneId: string;
  sheetId: string;
  prompt: string;
  refPackUrls: string[];
  variants: number;
  userId: string;
  timestamp: number;
}

/**
 * Get or create topic
 */
async function getOrCreateTopic(topicName: string): Promise<Topic> {
  const topic = pubsub.topic(topicName);
  const [exists] = await topic.exists();
  
  if (!exists) {
    await topic.create();
    logger.info({ topicName }, 'Created Pub/Sub topic');
  }
  
  return topic;
}

/**
 * Get or create subscription
 */
async function getOrCreateSubscription(
  topicName: string,
  subscriptionName: string
): Promise<Subscription> {
  const topic = await getOrCreateTopic(topicName);
  const subscription = topic.subscription(subscriptionName);
  const [exists] = await subscription.exists();
  
  if (!exists) {
    await subscription.create();
    logger.info({ subscriptionName }, 'Created Pub/Sub subscription');
  }
  
  return subscription;
}

/**
 * Publish image generation job to queue
 */
export async function publishImageJob(job: ImageJobMessage): Promise<string> {
  if (env.RUN_MODE === 'dry_run') {
    logger.info({ jobId: job.jobId }, 'Dry run - would publish job');
    return `dry-run-${job.jobId}`;
  }
  
  try {
    const topic = await getOrCreateTopic(IMAGE_GENERATION_TOPIC);
    const messageId = await topic.publishMessage({
      json: job,
      attributes: {
        jobId: job.jobId,
        sceneId: job.sceneId,
        timestamp: job.timestamp.toString(),
      },
    });
    
    logger.info({ jobId: job.jobId, messageId }, 'Published job to Pub/Sub');
    return messageId;
  } catch (error) {
    logger.error({ error, jobId: job.jobId }, 'Failed to publish job');
    throw new Error(`Failed to publish job: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get subscription for image generation jobs
 */
export async function getImageJobSubscription(): Promise<Subscription> {
  return getOrCreateSubscription(IMAGE_GENERATION_TOPIC, IMAGE_GENERATION_SUBSCRIPTION);
}

/**
 * Batch publish multiple jobs
 */
export async function publishImageJobBatch(jobs: ImageJobMessage[]): Promise<string[]> {
  if (env.RUN_MODE === 'dry_run') {
    logger.info({ count: jobs.length }, 'Dry run - would publish batch');
    return jobs.map(job => `dry-run-${job.jobId}`);
  }
  
  try {
    const topic = await getOrCreateTopic(IMAGE_GENERATION_TOPIC);
    const promises = jobs.map(job => 
      topic.publishMessage({
        json: job,
        attributes: {
          jobId: job.jobId,
          sceneId: job.sceneId,
          timestamp: job.timestamp.toString(),
        },
      })
    );
    
    const messageIds = await Promise.all(promises);
    logger.info({ count: jobs.length }, 'Published batch to Pub/Sub');
    return messageIds;
  } catch (error) {
    logger.error({ error, count: jobs.length }, 'Failed to publish batch');
    throw new Error(`Failed to publish batch: ${error instanceof Error ? error.message : String(error)}`);
  }
}