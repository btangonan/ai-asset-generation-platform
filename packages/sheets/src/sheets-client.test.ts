import { describe, it, expect } from 'vitest';
import { SheetsClient } from './sheets-client.js';

describe('SheetsClient', () => {
  it('should construct without throwing', () => {
    expect(() => {
      new SheetsClient('test-sheet-id', 'test-api-key');
    }).not.toThrow();
  });

  it('should generate correct sheet row array structure', () => {
    const client = new SheetsClient('test-sheet-id', 'test-api-key');
    // Test private method via any - this is for testing only
    const sheetRowToArray = (client as any).sheetRowToArray;
    
    const testRow = {
      scene_id: 'TEST-001',
      mode: 'variation',
      prompt: 'Test prompt',
    };

    const result = sheetRowToArray(testRow);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe('TEST-001'); // scene_id should be first
  });
});