import { z } from 'zod';

// Base schemas
export const RunModeSchema = z.enum(['dry_run', 'live']);
export const ModeSchema = z.enum(['variation', 'sequence']);
export const VeoModelSchema = z.enum(['veo3', 'veo3_fast']);
export const AspectSchema = z.enum(['16:9', '9:16']);
export const ResolutionSchema = z.union([z.literal(720), z.literal(1080)]);

// Reference image schemas
export const ReferenceModeSchema = z.enum(['style_only', 'style_and_composition']);

// Reference URL with mode and optional hash
export const RefUrlSchema = z.object({
  url: z.string().url().startsWith('https://'),
  mode: ReferenceModeSchema.optional().default('style_only'),
  hash: z.string().optional(), // SHA-256 of content
}).strict();

export type RefUrl = z.infer<typeof RefUrlSchema>;

// Image batch schemas (Phase 1 - active)
export const ImageBatchItemSchema = z.object({
  scene_id: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
  ref_pack_id: z.string().optional(), // Global pack reference
  ref_pack_public_urls: z.array(RefUrlSchema).max(6).optional(), // Per-row refs
  reference_mode: ReferenceModeSchema.optional().default('style_only'),
  variants: z.number().int().min(1).max(3), // Hard cap at 3
}).strict(); // Reject additional properties for security

export const ImageBatchRequestSchema = z.object({
  items: z.array(ImageBatchItemSchema).min(1).max(10),
  runMode: RunModeSchema.default('dry_run'),
}).strict(); // Reject additional properties for security

// Video batch schemas (Phase 1 - future-proofed, Phase 2 - active)
export const VideoBatchItemSchema = z.object({
  scene_id: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
  approved_image_url: z.string().url(),
  veo_model: VeoModelSchema,
  aspect: AspectSchema,
  resolution: ResolutionSchema,
  duration_s: z.literal(8),    // Hard constraint
  fps: z.literal(24),          // Hard constraint
});

export const VideoBatchRequestSchema = z.object({
  items: z.array(VideoBatchItemSchema).min(1).max(50),
  runMode: RunModeSchema.default('dry_run'),
  confirmCount: z.number().int().min(1),  // User must type exact count
});

// Sheet row schema (complete future-proofed version)
export const SheetRowSchema = z.object({
  scene_id: z.string(),
  mode: ModeSchema,
  prompt: z.string(),
  ref_pack_id: z.string(),
  ref_pack_url: z.string(),
  ref_pack_public_url: z.string().url(),
  style_kit_id: z.string().optional(),
  
  // Image fields
  status_img: z.enum(['queued', 'running', 'awaiting_review', 'error']),
  nano_img_1: z.string().url().optional(),
  nano_img_2: z.string().url().optional(),
  nano_img_3: z.string().url().optional(),
  
  // Video fields (future-proofed)
  approved_image_url: z.string().url().optional(),
  veo_model: VeoModelSchema,
  aspect: AspectSchema,
  resolution: ResolutionSchema,
  duration_s: z.literal(8),
  fps: z.literal(24),
  est_cost_video: z.number().min(0),
  status_video: z.enum(['ready_to_queue', 'queued', 'running', 'done', 'error']),
  video_url: z.string().url().optional(),
  
  // Job tracking
  job_id: z.string().optional(),
  locked_by: z.string().email().optional(),
});

// Job status schema
export const JobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  progress: z.number().min(0).max(1).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  estimatedCompletion: z.string().datetime().optional(),
  outputs: z.array(z.string().url()),
  error: z.string().optional(),
});

// Image generation schemas with reference support
export const GenerateImagesParamsSchema = z.object({
  sceneId: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
  variants: z.number().int().min(1).max(3),
  referenceImages: z.array(z.string().url()).max(6).optional(),
  referenceMode: ReferenceModeSchema.optional(),
}).strict();

export const GeneratedImageSchema = z.object({
  variantNumber: z.number().int().min(1),
  gcsUri: z.string().regex(/^gs:\/\//),
  signedUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sizeBytes: z.number().int().positive(),
    mimeType: z.string(),
  }).optional(),
}).strict();

export const GenerateImagesResultSchema = z.object({
  sceneId: z.string(),
  images: z.array(GeneratedImageSchema),
  processingTimeMs: z.number().int().positive(),
  referenceImagesUsed: z.array(z.string()).optional(),
  error: z.string().optional(),
}).strict();