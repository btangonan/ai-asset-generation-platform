import type { FastifyInstance } from 'fastify';
import { handleReferenceUpload } from './upload-reference.js';

export async function uploadRoutes(fastify: FastifyInstance) {
  // POST /upload-reference
  // Upload reference images to GCS and return signed URLs
  fastify.post('/upload-reference', {
    schema: {
      summary: 'Upload reference images',
      description: 'Upload reference images to cloud storage and get signed URLs for use in image generation',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            batchId: { type: 'string' },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  originalName: { type: 'string' },
                  url: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  gcsUri: { type: 'string' },
                  size: { type: 'number' },
                  mimeType: { type: 'string' },
                  uploadedAt: { type: 'string' }
                }
              }
            },
            totalSize: { type: 'number' }
          }
        }
      }
    }
  }, handleReferenceUpload);
}