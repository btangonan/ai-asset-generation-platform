import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.e2e.{test,spec}.{js,ts}'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000, // E2E tests may take longer
  },
});