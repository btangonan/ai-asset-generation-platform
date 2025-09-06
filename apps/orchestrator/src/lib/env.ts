import { z } from 'zod';

// Trim and clean string inputs to handle Cloud Run env var quirks
const trim = z.string().transform(s => s.trim());
const optionalTrim = z.string().transform(s => s.trim()).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(9090),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  
  // Google Cloud
  GOOGLE_CLOUD_PROJECT: trim,
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // Storage
  GCS_BUCKET: trim,
  SIGNED_URL_EXPIRY_DAYS: z.coerce.number().default(7),
  SIGNED_URL_DAYS: z.coerce.number().default(7),
  
  // Image processing
  SHARP_CONCURRENCY: z.coerce.number().default(4),
  
  // Pub/Sub
  PUBSUB_TOPIC_IMAGES: z.string().default('image-processing'),
  PUBSUB_SUBSCRIPTION_IMAGES: z.string().default('image-processing-sub'),
  
  // Sheets
  GOOGLE_SHEETS_API_KEY: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  
  // Gemini - Optional in prod, may use ADC
  GEMINI_API_KEY: optionalTrim,
  
  // Rate limiting
  MAX_ROWS_PER_BATCH: z.coerce.number().default(10),
  MAX_VARIANTS_PER_ROW: z.coerce.number().default(3),
  USER_COOLDOWN_MINUTES: z.coerce.number().default(10),
  USER_DAILY_LIMIT: z.coerce.number().default(100),
  
  // Cost controls
  RUN_MODE: z.enum(['dry_run', 'live']).default('dry_run'),
  DAILY_BUDGET_USD: z.coerce.number().default(100),
  
  // Authentication - API Keys for client access (optional, graceful degradation)
  AI_PLATFORM_API_KEY_1: optionalTrim,
  AI_PLATFORM_API_KEY_2: optionalTrim,
  AI_PLATFORM_API_KEY_3: optionalTrim,
});

export function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Log paths only, not values - safe for production logs
    console.error('Invalid env configuration:', 
      parsed.error.issues.map(i => ({ path: i.path, code: i.code, message: i.message })));
    process.exit(1);
  }
  return parsed.data;
}

// Maintain backward compatibility
export const env = loadEnv();