import { describe, it, expect } from 'vitest';
import { mergeRefs } from './ref-merge';

describe('mergeRefs', () => {
  const mockHasher = async (url: string) => url; // Simple mock - use URL as hash
  
  it('should prioritize per-row refs over global refs', async () => {
    const rowRefs = [
      { url: 'https://row1.jpg', mode: 'style_only' as const },
      { url: 'https://row2.jpg', mode: 'style_only' as const },
    ];
    const globalRefs = [
      { url: 'https://global1.jpg', mode: 'style_only' as const },
      { url: 'https://global2.jpg', mode: 'style_only' as const },
    ];
    
    const result = await mergeRefs(rowRefs, globalRefs, 3, mockHasher);
    
    expect(result).toHaveLength(3);
    expect(result[0].url).toBe('https://row1.jpg');
    expect(result[1].url).toBe('https://row2.jpg');
    expect(result[2].url).toBe('https://global1.jpg');
  });
  
  it('should deduplicate based on hash', async () => {
    const rowRefs = [
      { url: 'https://duplicate.jpg', mode: 'style_only' as const },
    ];
    const globalRefs = [
      { url: 'https://duplicate.jpg', mode: 'style_only' as const }, // Same URL
      { url: 'https://unique.jpg', mode: 'style_only' as const },
    ];
    
    const result = await mergeRefs(rowRefs, globalRefs, 6, mockHasher);
    
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://duplicate.jpg');
    expect(result[1].url).toBe('https://unique.jpg');
  });
  
  it('should respect cap limit', async () => {
    const rowRefs = Array(10).fill(null).map((_, i) => ({
      url: `https://row${i}.jpg`,
      mode: 'style_only' as const,
    }));
    
    const result = await mergeRefs(rowRefs, [], 6, mockHasher);
    
    expect(result).toHaveLength(6);
  });
});