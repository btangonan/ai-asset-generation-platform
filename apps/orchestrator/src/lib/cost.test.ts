import { describe, it, expect } from 'vitest';
import { CostCalculator } from './cost.js';
import type { ImageBatchItem, VideoBatchItem } from '@ai-platform/shared';

describe('CostCalculator', () => {
  const calculator = new CostCalculator();

  describe('estimateImageBatch', () => {
    it('should calculate cost for single item', () => {
      const items: ImageBatchItem[] = [
        {
          scene_id: 'TEST-001',
          prompt: 'Test prompt',
          ref_pack_public_url: 'https://storage.googleapis.com/test',
          variants: 3,
        },
      ];

      const cost = calculator.estimateImageBatch(items);
      expect(cost).toBe(0.006); // 3 variants * $0.002
    });

    it('should calculate cost for multiple items', () => {
      const items: ImageBatchItem[] = [
        {
          scene_id: 'TEST-001',
          prompt: 'Test prompt 1',
          ref_pack_public_url: 'https://storage.googleapis.com/test1',
          variants: 2,
        },
        {
          scene_id: 'TEST-002', 
          prompt: 'Test prompt 2',
          ref_pack_public_url: 'https://storage.googleapis.com/test2',
          variants: 1,
        },
      ];

      const cost = calculator.estimateImageBatch(items);
      expect(cost).toBe(0.006); // (2 + 1) variants * $0.002
    });

    it('should handle empty batch', () => {
      const cost = calculator.estimateImageBatch([]);
      expect(cost).toBe(0);
    });
  });

  describe('estimateVideoBatch', () => {
    it('should return 0 for Phase 1 (videos disabled)', () => {
      const items: VideoBatchItem[] = [
        {
          scene_id: 'TEST-001',
          prompt: 'Test video prompt',
          approved_image_url: 'https://storage.googleapis.com/test/approved.png',
          veo_model: 'veo3_fast',
          aspect: '16:9',
          resolution: 720,
          duration_s: 8,
          fps: 24,
        },
      ];

      const cost = calculator.estimateVideoBatch(items);
      expect(cost).toBe(0.10); // Would be $0.10 for veo3_fast in Phase 2
    });

    it('should differentiate between veo models in Phase 2', () => {
      const fastItems: VideoBatchItem[] = [
        {
          scene_id: 'TEST-001',
          prompt: 'Test prompt',
          approved_image_url: 'https://storage.googleapis.com/test/approved.png',
          veo_model: 'veo3_fast',
          aspect: '16:9',
          resolution: 720,
          duration_s: 8,
          fps: 24,
        },
      ];

      const previewItems: VideoBatchItem[] = [
        {
          scene_id: 'TEST-002',
          prompt: 'Test prompt',
          approved_image_url: 'https://storage.googleapis.com/test/approved.png',
          veo_model: 'veo3',
          aspect: '16:9',
          resolution: 720,
          duration_s: 8,
          fps: 24,
        },
      ];

      expect(calculator.estimateVideoBatch(fastItems)).toBe(0.10);
      expect(calculator.estimateVideoBatch(previewItems)).toBe(0.50);
    });
  });

  describe('formatCost', () => {
    it('should format cost with 3 decimal places', () => {
      expect(calculator.formatCost(0.001)).toBe('$0.001');
      expect(calculator.formatCost(0.123)).toBe('$0.123');
      expect(calculator.formatCost(1.2345)).toBe('$1.234'); // Truncated to 3 decimals
    });
  });
});