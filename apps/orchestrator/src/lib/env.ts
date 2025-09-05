import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  
  // Google Cloud
  GOOGLE_CLOUD_PROJECT: z.string(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // Storage
  GCS_BUCKET: z.string(),
  SIGNED_URL_EXPIRY_DAYS: z.coerce.number().default(7),
  
  // Pub/Sub
  PUBSUB_TOPIC_IMAGES: z.string().default('image-processing'),
  PUBSUB_SUBSCRIPTION_IMAGES: z.string().default('image-processing-sub'),
  
  // Sheets
  GOOGLE_SHEETS_API_KEY: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  
  // Gemini
  GEMINI_API_KEY: z.string(),
  
  // Rate limiting
  MAX_ROWS_PER_BATCH: z.coerce.number().default(10),
  MAX_VARIANTS_PER_ROW: z.coerce.number().default(3),
  USER_COOLDOWN_MINUTES: z.coerce.number().default(10),
  USER_DAILY_LIMIT: z.coerce.number().default(100),
  
  // Cost controls
  RUN_MODE: z.enum(['dry_run', 'live']).default('dry_run'),
  DAILY_BUDGET_USD: z.coerce.number().default(100),
});

export const env = envSchema.parse(process.env);