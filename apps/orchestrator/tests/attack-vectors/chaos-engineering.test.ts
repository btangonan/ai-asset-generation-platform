import { test, expect, describe, beforeAll, afterAll, vi } from 'vitest';
import { build } from '../helpers/test-helper';
import type { FastifyInstance } from 'fastify';
import * as gcsModule from '../../src/lib/gcs';
import * as sheetsModule from '../../src/lib/sheets';

describe('🌪️ Chaos Engineering - External Service Failures', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = await build();
  });
  
  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('☁️ GCS Failure Scenarios', () => {
    test('GCS upload complete failure', async () => {
      // Mock GCS to always fail
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue(
        new Error('GCS Service Unavailable')
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'gcs-fail-test', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      // Should handle GCS failure gracefully, not crash
      expect(response.statusCode).not.toBe(500);
      
      // Should provide meaningful error message
      if (response.statusCode !== 200) {
        const error = response.json();
        expect(error.error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('GCS intermittent failures (80% failure rate)', async () => {
      let callCount = 0;
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => {
        callCount++;
        if (callCount % 5 !== 0) { // Fail 80% of the time
          return Promise.reject(new Error('GCS Timeout'));
        }
        return Promise.resolve({
          gcsUri: 'gs://test-bucket/test-path',
          signedUrl: 'https://storage.googleapis.com/test-signed-url'
        });
      });
      
      const requests = Array(10).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{ scene_id: `intermittent-${i}`, prompt: 'test', variants: 1 }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(requests);
      
      // Should handle intermittent failures gracefully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      const failed = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode !== 200
      );
      
      console.log(`Intermittent GCS failures: ${successful.length} success, ${failed.length} failed`);
      
      // At least some requests should succeed due to retry logic
      expect(successful.length).toBeGreaterThan(0);
    });

    test('GCS signed URL generation failure', async () => {
      vi.spyOn(gcsModule, 'generateSignedUrl').mockRejectedValue(
        new Error('Unable to generate signed URL: Permission denied')
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'signed-url-fail', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      // Should handle signed URL failures
      expect(response.statusCode).not.toBe(500);
    });

    test('GCS quota exceeded scenario', async () => {
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue({
        code: 429,
        message: 'Quota exceeded. Too many requests'
      });
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'quota-exceeded', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      // Should handle quota exceeded gracefully
      expect(response.statusCode).not.toBe(500);
      if (response.statusCode !== 200) {
        const error = response.json();
        expect(error.message).toContain('quota');
      }
    });
  });

  describe('📊 Google Sheets Failure Scenarios', () => {
    test('Sheets API complete failure', async () => {
      const originalUpdateRow = sheetsModule.updateSheetRow;
      vi.spyOn(sheetsModule, 'updateSheetRow').mockRejectedValue(
        new Error('Google Sheets API is unavailable')
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'sheets-fail-test', prompt: 'test', variants: 1 }],
          runMode: 'dry_run'
        }
      });
      
      // Should still process images even if sheets update fails
      // This tests graceful degradation
      expect(response.statusCode).not.toBe(500);
    });

    test('Sheets quota exceeded', async () => {
      vi.spyOn(sheetsModule, 'updateSheetRow').mockRejectedValue({
        code: 429,
        message: 'Quota exceeded for Google Sheets API'
      });
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'sheets-quota', prompt: 'test', variants: 1 }],
          runMode: 'dry_run'
        }
      });
      
      // Should handle sheets quota issues
      expect(response.statusCode).not.toBe(500);
    });

    test('Sheets permission denied', async () => {
      vi.spyOn(sheetsModule, 'updateSheetRow').mockRejectedValue({
        code: 403,
        message: 'Permission denied for Google Sheets'
      });
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'sheets-permission', prompt: 'test', variants: 1 }],
          runMode: 'dry_run'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });
  });

  describe('🧠 Sharp/Image Processing Failures', () => {
    test('Sharp process crash simulation', async () => {
      vi.spyOn(gcsModule, 'makeThumb').mockRejectedValue(
        new Error('Sharp process crashed')
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'sharp-crash', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      // Should handle Sharp failures gracefully
      expect(response.statusCode).not.toBe(500);
    });

    test('Out of memory during image processing', async () => {
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue(
        new Error('Cannot allocate memory')
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'oom-test', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });
  });

  describe('🌐 Network Failure Scenarios', () => {
    test('Network timeout simulation', async () => {
      // Simulate network timeout
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ETIMEDOUT')), 100)
        )
      );
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'timeout-test', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });

    test('DNS resolution failure', async () => {
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND storage.googleapis.com'
      });
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'dns-fail', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });

    test('Connection refused scenario', async () => {
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED'
      });
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'conn-refused', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });
  });

  describe('🎭 "Perfect Storm" Scenarios', () => {
    test('Multiple simultaneous service failures', async () => {
      // Simulate everything failing at once
      vi.spyOn(gcsModule, 'putObject').mockRejectedValue(new Error('GCS failed'));
      vi.spyOn(gcsModule, 'generateSignedUrl').mockRejectedValue(new Error('Signed URL failed'));
      vi.spyOn(gcsModule, 'makeThumb').mockRejectedValue(new Error('Sharp failed'));
      vi.spyOn(sheetsModule, 'updateSheetRow').mockRejectedValue(new Error('Sheets failed'));
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          items: [{ scene_id: 'perfect-storm', prompt: 'test', variants: 1 }],
          runMode: 'live'
        }
      });
      
      // Even when everything fails, should not crash
      expect(response.statusCode).not.toBe(500);
      
      // Should provide meaningful error message
      if (response.statusCode !== 200) {
        const error = response.json();
        expect(error.error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('High load during service failures', async () => {
      // Simulate failures under high load
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => {
        if (Math.random() < 0.7) { // 70% failure rate
          return Promise.reject(new Error('Service overloaded'));
        }
        return Promise.resolve({
          gcsUri: 'gs://test-bucket/test-path',
          signedUrl: 'https://storage.googleapis.com/test-signed-url'
        });
      });
      
      const highLoadRequests = Array(50).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{ scene_id: `load-fail-${i}`, prompt: 'test', variants: 1 }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(highLoadRequests);
      
      // Should handle high load + failures without crashing
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(serverErrors).toHaveLength(0);
    });

    test('Resource exhaustion during failures', async () => {
      // Simulate resource exhaustion + service failures
      const initialMemory = process.memoryUsage();
      
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => {
        // Create some memory pressure
        const waste = Buffer.alloc(1024 * 1024); // 1MB
        return Math.random() < 0.5 
          ? Promise.reject(new Error('Resource exhausted'))
          : Promise.resolve({
              gcsUri: 'gs://test-bucket/test-path',
              signedUrl: 'https://storage.googleapis.com/test-signed-url'
            });
      });
      
      const requests = Array(30).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{ scene_id: `resource-fail-${i}`, prompt: 'test', variants: 2 }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(requests);
      const finalMemory = process.memoryUsage();
      
      console.log(`Memory delta: ${Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`);
      
      // Should not crash under resource pressure + failures
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('🔄 Recovery Testing', () => {
    test('Service recovery after failures', async () => {
      let failureCount = 0;
      const maxFailures = 5;
      
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => {
        if (failureCount < maxFailures) {
          failureCount++;
          return Promise.reject(new Error('Temporary service failure'));
        }
        // Service "recovers" after 5 failures
        return Promise.resolve({
          gcsUri: 'gs://test-bucket/test-path',
          signedUrl: 'https://storage.googleapis.com/test-signed-url'
        });
      });
      
      const requests = Array(10).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{ scene_id: `recovery-${i}`, prompt: 'test', variants: 1 }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(requests);
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      
      // Should start succeeding after service recovery
      expect(successful.length).toBeGreaterThan(0);
    });

    test('Circuit breaker behavior simulation', async () => {
      // Simulate a basic circuit breaker pattern
      let consecutiveFailures = 0;
      const failureThreshold = 3;
      let circuitOpen = false;
      
      vi.spyOn(gcsModule, 'putObject').mockImplementation(() => {
        if (circuitOpen) {
          return Promise.reject(new Error('Circuit breaker open'));
        }
        
        if (consecutiveFailures < failureThreshold) {
          consecutiveFailures++;
          return Promise.reject(new Error('Service failure'));
        }
        
        circuitOpen = true;
        return Promise.reject(new Error('Circuit breaker triggered'));
      });
      
      const requests = Array(8).fill(0).map((_, i) => 
        app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: { 'content-type': 'application/json' },
          payload: {
            items: [{ scene_id: `circuit-${i}`, prompt: 'test', variants: 1 }],
            runMode: 'live'
          }
        })
      );
      
      const results = await Promise.allSettled(requests);
      
      // All should fail gracefully, none should crash the server
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 500
      );
      expect(serverErrors).toHaveLength(0);
    });
  });
});