import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { build, expectValidResponse } from '../helpers/test-helper';
import type { FastifyInstance } from 'fastify';

describe('⚡ Concurrency & Race Condition Chaos Tests', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = await build();
  });
  
  afterAll(async () => {
    await app.close();
  });

  describe('🏎️ Race Condition Attacks', () => {
    test('100 simultaneous requests with same scene_id', async () => {
      const sceneId = 'race-condition-target';
      const concurrentRequests = 100;
      
      // Launch 100 concurrent requests with the same scene_id
      const promises = Array(concurrentRequests).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: sceneId,
              prompt: `Race condition test ${i}`,
              variants: 1
            }],
            runMode: 'dry_run'
          }
        })
      );
      
      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200);
      const failed = results.filter(r => r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value.statusCode !== 200));
      
      console.log(`Race condition test: ${successful.length}/${concurrentRequests} successful in ${endTime - startTime}ms`);
      
      // Should handle concurrent requests without crashing
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      // No 500 errors (server crashes)
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(serverErrors).toHaveLength(0);
      
      // Should have some successful requests
      expect(successful.length).toBeGreaterThan(0);
      
      // Check for data consistency - all successful requests should have valid batch IDs
      successful.forEach(result => {
        if (result.status === 'fulfilled') {
          expectValidResponse(result.value);
        }
      });
    });

    test('Rapid-fire scene_id conflicts', async () => {
      const baseSceneId = 'conflict-test';
      const batchSize = 50;
      
      // Create multiple batches with potential conflicts
      const batches = Array(5).fill(0).map((_, batchIndex) =>
        Array(batchSize).fill(0).map((_, i) => ({
          scene_id: `${baseSceneId}-${i % 10}`, // Force conflicts
          prompt: `Batch ${batchIndex}, item ${i}`,
          variants: Math.floor(Math.random() * 3) + 1
        }))
      );
      
      const promises = batches.map(batch => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: batch,
            runMode: 'dry_run'
          }
        })
      );
      
      const results = await Promise.allSettled(promises);
      
      // Should handle batch conflicts gracefully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.statusCode).not.toBe(500);
        }
      });
    });

    test('Memory pressure during concurrent Sharp operations', async () => {
      // This test simulates high memory pressure during image processing
      const heavyRequests = Array(20).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: `memory-pressure-${i}`,
              prompt: 'Generate a highly detailed 4K resolution digital artwork with complex patterns, vibrant colors, intricate details, and photorealistic textures that would require significant processing power and memory allocation',
              variants: 3
            }],
            runMode: 'live' // Use live mode to actually stress Sharp
          }
        })
      );
      
      const startMemory = process.memoryUsage();
      const results = await Promise.allSettled(heavyRequests);
      const endMemory = process.memoryUsage();
      
      console.log('Memory usage:', {
        start: `${Math.round(startMemory.heapUsed / 1024 / 1024)}MB`,
        end: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
        delta: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)}MB`
      });
      
      // Should not crash due to memory pressure
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      // No server errors
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(serverErrors).toHaveLength(0);
    });
  });

  describe('🌪️ Resource Contention Attacks', () => {
    test('File descriptor exhaustion attack', async () => {
      // Create many concurrent requests to potentially exhaust file descriptors
      const massiveRequests = Array(200).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: `fd-exhaust-${i}`,
              prompt: 'Simple test prompt',
              variants: 1
            }],
            runMode: 'dry_run'
          }
        })
      );
      
      const results = await Promise.allSettled(massiveRequests);
      
      // Should handle resource pressure gracefully
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      console.log(`FD exhaustion test: ${fulfilled.length} fulfilled, ${rejected.length} rejected`);
      
      // Even if some requests fail, should not crash entirely
      expect(fulfilled.length).toBeGreaterThan(0);
      
      // No server crashes
      fulfilled.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.statusCode).not.toBe(500);
        }
      });
    });

    test('Network connection pool saturation', async () => {
      // Test if external service calls can saturate connection pools
      const healthChecks = Array(100).fill(0).map(() => 
        app.inject({
          method: 'GET',
          url: '/readiness'
        })
      );
      
      const apiCalls = Array(50).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: `connection-pool-${i}`,
              prompt: 'Test prompt',
              variants: 1
            }],
            runMode: 'dry_run'
          }
        })
      );
      
      const allRequests = [...healthChecks, ...apiCalls];
      const results = await Promise.allSettled(allRequests);
      
      // Should handle connection pressure
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(serverErrors).toHaveLength(0);
    });

    test('Concurrent GCS operations race conditions', async () => {
      // Test concurrent operations that might conflict in GCS
      const samePathRequests = Array(30).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: 'gcs-race-test', // Same scene_id to potentially conflict
              prompt: `GCS race test ${i}`,
              variants: 2
            }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(samePathRequests);
      
      // Should handle GCS conflicts gracefully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      
      // At least some should succeed
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('⏰ Timing Attack Scenarios', () => {
    test('Burst traffic simulation', async () => {
      // Simulate sudden burst of traffic
      const burstSize = 75;
      const requests = [];
      
      // Create burst in waves
      for (let wave = 0; wave < 3; wave++) {
        const waveRequests = Array(burstSize).fill(0).map((_, i) => 
          app.inject({
            method: 'POST',
            url: '/batch/images',
            headers: { 'content-type': 'application/json' },
            payload: {
              items: [{
                scene_id: `burst-wave-${wave}-${i}`,
                prompt: `Burst test wave ${wave}, request ${i}`,
                variants: 1
              }],
              runMode: 'dry_run'
            }
          })
        );
        requests.push(...waveRequests);
        
        // Small delay between waves
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const results = await Promise.allSettled(requests);
      
      // Analyze burst handling
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      ).length;
      const failed = results.length - successful;
      
      console.log(`Burst test: ${successful}/${results.length} successful (${failed} failed)`);
      
      // Should handle burst traffic without complete failure
      expect(successful).toBeGreaterThan(results.length * 0.5); // At least 50% success
      
      // No server crashes
      const crashed = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(crashed).toHaveLength(0);
    });

    test('Sustained load with timeouts', async () => {
      const sustainedRequests = [];
      const duration = 5000; // 5 seconds
      const rps = 20; // Requests per second
      const interval = 1000 / rps;
      
      const startTime = Date.now();
      let requestCount = 0;
      
      // Generate sustained load
      while (Date.now() - startTime < duration) {
        sustainedRequests.push(
          app.inject({
            method: 'POST',
            url: '/batch/images',
            headers: { 'content-type': 'application/json' },
            payload: {
              items: [{
                scene_id: `sustained-${requestCount++}`,
                prompt: 'Sustained load test',
                variants: 1
              }],
              runMode: 'dry_run'
            }
          })
        );
        
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      const results = await Promise.allSettled(sustainedRequests);
      const actualDuration = Date.now() - startTime;
      const actualRps = results.length / (actualDuration / 1000);
      
      console.log(`Sustained load: ${results.length} requests over ${actualDuration}ms (${actualRps.toFixed(1)} RPS)`);
      
      // Should handle sustained load
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      expect(successful.length).toBeGreaterThan(results.length * 0.8); // 80% success rate
    }, 10000); // 10 second timeout
  });

  describe('🔄 State Corruption Tests', () => {
    test('Concurrent modifications of shared state', async () => {
      // Test if concurrent requests can corrupt shared state
      const sharedSceneId = 'shared-state-test';
      
      const conflictingRequests = Array(50).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{
              scene_id: sharedSceneId,
              prompt: `State test ${i}`,
              variants: Math.random() > 0.5 ? 1 : 3 // Vary variants to test different code paths
            }],
            runMode: 'dry_run'
          }
        })
      );
      
      const results = await Promise.allSettled(conflictingRequests);
      
      // Check for state consistency
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      
      successful.forEach(result => {
        if (result.status === 'fulfilled') {
          expectValidResponse(result.value);
        }
      });
    });

    test('Memory leak detection under concurrency', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run multiple rounds of concurrent requests
      for (let round = 0; round < 5; round++) {
        const requests = Array(30).fill(0).map((_, i) => 
          app.inject({
            method: 'POST',
            url: '/batch/images',
            headers: { 'content-type': 'application/json' },
            payload: {
              items: [{
                scene_id: `memory-leak-${round}-${i}`,
                prompt: 'Memory leak detection test',
                variants: 2
              }],
              runMode: 'live'
            }
          })
        );
        
        await Promise.allSettled(requests);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage();
        console.log(`Round ${round + 1} memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024);
      
      console.log(`Memory growth: ${memoryGrowthMB}MB`);
      
      // Should not have excessive memory growth (allow some growth for caching)
      expect(memoryGrowthMB).toBeLessThan(100); // Less than 100MB growth
    }, 30000); // 30 second timeout for memory test
  });
});