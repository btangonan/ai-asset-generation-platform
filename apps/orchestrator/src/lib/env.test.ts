import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Import the schema directly for testing
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
  
  // Cost controls
  RUN_MODE: z.enum(['dry_run', 'live']).default('dry_run'),
  DAILY_BUDGET_USD: z.coerce.number().default(100),
});

describe('Environment Configuration', () => {
  it('should parse environment variables with defaults', () => {
    const testEnv = {
      GOOGLE_CLOUD_PROJECT: 'test-project',
      GCS_BUCKET: 'test-bucket',  
      GEMINI_API_KEY: 'test-key',
    };
    
    const env = envSchema.parse(testEnv);
    
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RUN_MODE).toBe('dry_run');
    expect(env.MAX_ROWS_PER_BATCH).toBe(10);
  });

  it('should parse custom environment values', () => {
    const testEnv = {
      PORT: '9000',
      LOG_LEVEL: 'debug',
      RUN_MODE: 'live',
      MAX_ROWS_PER_BATCH: '5',
      GOOGLE_CLOUD_PROJECT: 'test-project',
      GCS_BUCKET: 'test-bucket',
      GEMINI_API_KEY: 'test-key',
    };
    
    const env = envSchema.parse(testEnv);
    
    expect(env.PORT).toBe(9000);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.RUN_MODE).toBe('live');
    expect(env.MAX_ROWS_PER_BATCH).toBe(5);
  });

  it('should throw on missing required variables', () => {
    const testEnv = {
      GCS_BUCKET: 'test-bucket',
      GEMINI_API_KEY: 'test-key',
    };
    
    expect(() => {
      envSchema.parse(testEnv);
    }).toThrow();
  });
});