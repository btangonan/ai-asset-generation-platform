import { z } from 'zod';
import type { 
  ImageBatchRequestSchema, 
  VideoBatchRequestSchema,
  ImageBatchItemSchema,
  VideoBatchItemSchema,
} from './schemas.js';

// Base types
export type RunMode = 'dry_run' | 'live';

export type ImageStatus = 'queued' | 'running' | 'awaiting_review' | 'error';
export type VideoStatus = 'ready_to_queue' | 'queued' | 'running' | 'done' | 'error';

export type Mode = 'variation' | 'sequence';
export type VeoModel = 'veo3' | 'veo3_fast';
export type Aspect = '16:9' | '9:16';
export type Resolution = 720 | 1080;

// Schema-derived types
export type ImageBatchRequest = z.infer<typeof ImageBatchRequestSchema>;
export type VideoBatchRequest = z.infer<typeof VideoBatchRequestSchema>;
export type ImageBatchItem = z.infer<typeof ImageBatchItemSchema>;
export type VideoBatchItem = z.infer<typeof VideoBatchItemSchema>;

// Sheet row type (future-proofed with all columns)
export interface SheetRow {
  // Core fields
  scene_id: string;
  mode: Mode;
  prompt: string;
  
  // Reference pack
  ref_pack_id: string;
  ref_pack_url: string;  // Drive link (human)
  ref_pack_public_url: string;  // GCS signed URL (machine)
  
  // Style (optional)
  style_kit_id?: string;
  
  // Image generation (Phase 1 - active)
  status_img: ImageStatus;
  nano_img_1?: string;
  nano_img_2?: string;
  nano_img_3?: string;
  
  // Video preparation (Phase 1 - future-proofed)
  approved_image_url?: string;
  veo_model: VeoModel;
  aspect: Aspect;
  resolution: Resolution;
  duration_s: 8;  // Locked
  fps: 24;        // Locked
  est_cost_video: number;
  status_video: VideoStatus;
  video_url?: string;
  
  // Job tracking
  job_id?: string;
  locked_by?: string;  // User email
}

// API response types
export interface JobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  outputs: string[];
  error?: string;
}

export interface BatchResponse {
  batchId: string;
  runMode: RunMode;
  estimatedCost: number;
  accepted: number;
  rejected: string[];
  jobs?: Array<{
    jobId: string;
    sceneId: string;
    status: string;
  }>;
}