// Append-only budget ledger for cost tracking
import { Storage } from '@google-cloud/storage';
import { env } from './env.js';

const storage = new Storage();
const bucket = storage.bucket(env.GCS_BUCKET);

export async function appendLedger(entry: {
  ts: number;
  userId: string;
  jobId: string;
  prompt: string;
  images: number;
  cost: number;
  model?: string;
  requestId?: string;
}) {
  if (!env.BUDGET_LEDGER_ENABLED) return;
  
  const date = new Date(entry.ts).toISOString().split('T')[0];
  const filename = `ledger/${date}.jsonl`;
  const file = bucket.file(filename);
  
  // Enrich the entry with additional context
  const enrichedEntry = {
    ...entry,
    model: entry.model || 'nano-banana',
    requestId: entry.requestId || null,
  };
  
  const line = JSON.stringify(enrichedEntry) + '\n';
  await file.save(line, { resumable: false, validation: false });
}