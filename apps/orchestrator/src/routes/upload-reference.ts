/**
 * REFERENCE IMAGE UPLOAD ENDPOINT
 * 
 * Handles multipart file uploads for reference images using Fastify
 * - Validates image files (type, size)  
 * - Uploads to GCS with timestamped paths
 * - Returns signed URLs for immediate use
 * - Creates thumbnails for gallery display
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { putObject, makeThumb } from '../lib/gcs.js';
import { logger } from '../lib/logger.js';
import { sendProblemDetails, Problems } from '../lib/problem-details.js';

export interface UploadedReference {
  originalName: string;
  url: string;
  thumbnailUrl?: string;
  gcsUri: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface UploadResponse {
  success: boolean;
  batchId: string;
  images: UploadedReference[];
  totalSize: number;
}

/**
 * Upload reference images to GCS
 * POST /upload-reference
 * Content-Type: multipart/form-data
 * Files: images[] (up to 6 images, 10MB each)
 */
export async function handleReferenceUpload(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const data = await (request as any).files();
    const files: any[] = [];
    
    // Collect all files from the multipart stream
    for await (const part of data) {
      if (part.type === 'file' && part.fieldname === 'images') {
        // Validate file type
        if (!part.mimetype.startsWith('image/')) {
          return sendProblemDetails(reply, Problems.invalidRequestSchema(
            `File ${part.filename} is not an image. Only image files are allowed.`
          ));
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        const buffer = await part.toBuffer();
        if (buffer.length > maxSize) {
          return sendProblemDetails(reply, Problems.invalidRequestSchema(
            `File ${part.filename} exceeds 10MB limit`
          ));
        }

        files.push({
          filename: part.filename,
          mimetype: part.mimetype,
          buffer,
          size: buffer.length,
        });

        // Limit to 6 files
        if (files.length > 6) {
          return sendProblemDetails(reply, Problems.invalidRequestSchema(
            'Maximum 6 reference images allowed'
          ));
        }
      }
    }

    if (files.length === 0) {
      return sendProblemDetails(reply, Problems.invalidRequestSchema(
        'At least one image file is required'
      ));
    }

    // Generate batch ID for grouping related uploads
    const batchId = uuidv4().substring(0, 8);
    const timestamp = Date.now();
    const uploadedRefs: UploadedReference[] = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      logger.info({ 
        filename: file.filename, 
        size: file.size, 
        mimetype: file.mimetype 
      }, 'Processing reference image upload');

      // Generate unique GCS path
      const fileExt = file.filename?.split('.').pop()?.toLowerCase() || 'jpg';
      const gcsPath = `references/${batchId}/${timestamp}_${i + 1}.${fileExt}`;
      
      // Upload main image
      const { gcsUri, signedUrl } = await putObject(
        file.buffer,
        file.mimetype,
        gcsPath
      );

      // Create thumbnail
      let thumbnailUrl: string | undefined;
      try {
        const thumbBuffer = await makeThumb(file.buffer);
        const thumbPath = `references/${batchId}/${timestamp}_${i + 1}_thumb.png`;
        const thumbResult = await putObject(thumbBuffer, 'image/png', thumbPath);
        thumbnailUrl = thumbResult.signedUrl;
      } catch (thumbError) {
        logger.warn({ error: thumbError, gcsPath }, 'Failed to create thumbnail, continuing without');
      }

      const uploadedRef: UploadedReference = {
        originalName: file.filename || `image_${i + 1}`,
        url: signedUrl,
        gcsUri,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };
      
      if (thumbnailUrl) {
        uploadedRef.thumbnailUrl = thumbnailUrl;
      }
      
      uploadedRefs.push(uploadedRef);
    }

    logger.info({ 
      batchId, 
      uploadCount: uploadedRefs.length 
    }, 'Successfully uploaded reference images');

    const response: UploadResponse = {
      success: true,
      batchId,
      images: uploadedRefs,
      totalSize: uploadedRefs.reduce((sum, ref) => sum + ref.size, 0),
    };

    await reply.code(200).send(response);

  } catch (error) {
    logger.error({ error }, 'Reference upload endpoint error');
    return sendProblemDetails(reply, Problems.internalError(
      'Internal error processing upload request'
    ));
  }
}