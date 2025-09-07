import { Storage } from '@google-cloud/storage';
import { env } from './env.js';

const storage = new Storage();
const BUCKET = env.GCS_BUCKET;

export interface JobState {
  batchId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  items: Array<{
    sceneId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    imageUrls?: string[];
    error?: string;
  }>;
  startedAt: string;
  updatedAt: string;
}

/**
 * Save job state to GCS as JSON (with versioning)
 */
export async function saveState(batchId: string, state: JobState): Promise<void> {
  const data = JSON.stringify(state, null, 2);
  const timestamp = Date.now();
  
  // Save both current and versioned state
  await Promise.all([
    // Current state (always latest)
    storage.bucket(BUCKET).file(`jobs/${batchId}/state.json`).save(data, {
      contentType: 'application/json',
    }),
    // Versioned state for forensic rollback
    storage.bucket(BUCKET).file(`jobs/${batchId}/state-${timestamp}.json`).save(data, {
      contentType: 'application/json',
    })
  ]);
}

/**
 * Read job state from GCS
 */
export async function getState(batchId: string): Promise<JobState | null> {
  const file = storage.bucket(BUCKET).file(`jobs/${batchId}/state.json`);
  const [exists] = await file.exists();
  if (!exists) return null;
  
  const [contents] = await file.download();
  return JSON.parse(contents.toString());
}