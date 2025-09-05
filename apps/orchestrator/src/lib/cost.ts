import type { ImageBatchItem, VideoBatchItem } from '@ai-platform/shared';

export class CostCalculator {
  public readonly rates = {
    // Current rates (may change)
    gemini_image: 0.002,  // $0.002 per image
    veo3_preview: 0.50,   // $0.50 per video (8s)
    veo3_fast: 0.10,      // $0.10 per video (8s)
  } as const;

  estimateImageBatch(items: ImageBatchItem[]): number {
    return items.reduce((total, item) => {
      return total + (item.variants * this.rates.gemini_image);
    }, 0);
  }

  estimateVideoBatch(items: VideoBatchItem[]): number {
    // Phase 1: Return 0 (videos disabled)
    // Phase 2: Implement real calculation
    if (items.length === 0) return 0;
    
    return items.reduce((total, item) => {
      const rate = item.veo_model === 'veo3' 
        ? this.rates.veo3_preview 
        : this.rates.veo3_fast;
      return total + rate;
    }, 0);
  }

  formatCost(amount: number): string {
    return `$${Math.floor(amount * 1000) / 1000}`;
  }
}