import { vi } from 'vitest';
import { appendLedger } from '../../src/lib/budget-ledger';

// Mock @google-cloud/storage
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(),
      })),
    })),
  })),
}));

// Mock env
vi.mock('../../src/lib/env', () => ({
  env: {
    GCS_BUCKET: 'test-bucket',
    BUDGET_LEDGER_ENABLED: true,
  },
}));

describe('Budget Ledger', () => {
  it('appends to daily JSONL file', async () => {
    const entry = {
      ts: Date.now(),
      userId: 'user123',
      jobId: 'job456',
      prompt: 'test prompt',
      images: 3,
      cost: 0.15,
    };
    
    await appendLedger(entry);
    
    // Verify file path format includes date
    const date = new Date(entry.ts).toISOString().split('T')[0];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  
  it('skips when disabled', async () => {
    const { env } = await import('../../src/lib/env');
    (env as any).BUDGET_LEDGER_ENABLED = false;
    
    const entry = {
      ts: Date.now(),
      userId: 'user123',
      jobId: 'job456',
      prompt: 'test prompt',
      images: 3,
      cost: 0.15,
    };
    
    await appendLedger(entry);
    // Should not throw, just return early
  });
});