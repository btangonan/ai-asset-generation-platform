import { z } from 'zod';

/**
 * Image ingestion helper for fetching and processing reference images
 * Handles both GCS URIs and signed URLs
 */

// Validation schema for image URLs
const ImageUrlSchema = z.union([
  z.string().url().startsWith('https://'),
  z.string().regex(/^gs:\/\/[a-z0-9-_.]+\/.+/), // GCS URI format
]);

export interface IngestedImage {
  data: string; // Base64 encoded image data
  mimeType: string;
  sizeBytes: number;
  url: string; // Original URL for tracking
}

/**
 * Fetches an image from a URL and converts it to base64
 * @param url - The image URL (signed URL or public URL)
 * @returns Base64 encoded image data with metadata
 */
export async function fetchImageAsBase64(url: string): Promise<IngestedImage> {
  // Validate URL format
  const validationResult = ImageUrlSchema.safeParse(url);
  if (!validationResult.success) {
    throw new Error(`Invalid image URL format: ${url}`);
  }

  // Handle GCS URI by converting to signed URL
  if (url.startsWith('gs://')) {
    throw new Error(
      'GCS URIs (gs://) must be converted to signed URLs before ingestion. ' +
      'Use GCS client to generate signed URLs first.'
    );
  }

  try {
    // Fetch the image with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}. Expected image/*`);
    }

    // Get the image as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check size limit (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      throw new Error(`Image size ${buffer.length} exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Convert to base64
    const base64Data = buffer.toString('base64');

    return {
      data: base64Data,
      mimeType: contentType,
      sizeBytes: buffer.length,
      url: url,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Image fetch timeout for URL: ${url}`);
      }
      throw new Error(`Failed to ingest image from ${url}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Ingests multiple reference images in parallel
 * @param urls - Array of image URLs
 * @param maxConcurrency - Maximum number of parallel fetches (default: 3)
 * @returns Array of ingested images with metadata
 */
export async function ingestReferenceImages(
  urls: string[],
  maxConcurrency: number = 3
): Promise<IngestedImage[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  // Validate URL count
  if (urls.length > 6) {
    throw new Error(`Too many reference images: ${urls.length}. Maximum allowed is 6.`);
  }

  // Process images in batches to control concurrency
  const results: IngestedImage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (let i = 0; i < urls.length; i += maxConcurrency) {
    const batch = urls.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (url) => {
      try {
        return await fetchImageAsBase64(url);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ url, error: errorMessage });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((r): r is IngestedImage => r !== null));
  }

  // If any errors occurred, include them in the error message
  if (errors.length > 0) {
    const errorDetails = errors.map(e => `  - ${e.url}: ${e.error}`).join('\n');
    console.warn(`Failed to ingest ${errors.length} reference image(s):\n${errorDetails}`);
  }

  return results;
}

/**
 * Validates that reference images are accessible and within size limits
 * @param urls - Array of image URLs to validate
 * @returns Validation result with details
 */
export async function validateReferenceImages(
  urls: string[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check URL count
  if (urls.length > 6) {
    errors.push(`Too many reference images: ${urls.length}. Maximum allowed is 6.`);
  }

  // Validate each URL format
  for (const url of urls) {
    const validationResult = ImageUrlSchema.safeParse(url);
    if (!validationResult.success) {
      errors.push(`Invalid URL format: ${url}`);
    }
    if (url.startsWith('gs://')) {
      errors.push(`GCS URI must be converted to signed URL: ${url}`);
    }
  }

  // If format errors found, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check accessibility with HEAD requests
  const accessChecks = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          return `URL not accessible (${response.status}): ${url}`;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          return `Invalid content type for ${url}: ${contentType}`;
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          const maxSize = 10 * 1024 * 1024; // 10MB
          if (size > maxSize) {
            return `Image too large (${size} bytes) for ${url}. Max: ${maxSize} bytes`;
          }
        }

        return null;
      } catch (error) {
        return `Failed to validate ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    })
  );

  const validationErrors = accessChecks.filter((e): e is string => e !== null);
  errors.push(...validationErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}