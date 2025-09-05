import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables at module load time
// This runs before any imports that might parse process.env
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.GCS_BUCKET = 'test-bucket';
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.RUN_MODE = 'dry_run';

// Test environment setup
beforeAll(async () => {
  // Additional setup if needed
});

beforeEach(() => {
  // Clear any cached modules or state between tests
});

afterAll(async () => {
  // Cleanup after all tests
});