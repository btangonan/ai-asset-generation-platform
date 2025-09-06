import sharp from 'sharp';
import { putObject } from './gcs.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI with API key
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Model ID for Gemini 2.5 Flash Image (Nano Banana)
const NANO_BANANA_MODEL = 'gemini-2.5-flash-image-preview';

/**
 * Retry function with exponential backoff for API calls
 */
async function retry<T>(fn: () => Promise<T>, maxAttempts: number = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.code ?? 0;
      const retryable = [429, 500, 502, 503, 504].includes(status);
      
      if (!retryable || ++attempt > maxAttempts) {
        throw error;
      }
      
      const backoff = Math.min(2000 * Math.pow(2, attempt), 15000) + Math.random() * 250;
      logger.warn({ attempt, backoff, error: error.message }, 'Retrying Gemini API call');
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Generate an image using Gemini 2.5 Flash (Nano Banana)
 */
async function generateNanoBananaImage(prompt: string): Promise<Buffer> {
  const model = genAI.getGenerativeModel({ model: NANO_BANANA_MODEL });
  
  // Call generateContent with the prompt
  const result = await retry(async () => {
    return await model.generateContent({
      contents: [{
        parts: [{
          text: `Generate an image: ${prompt}`
        }]
      }]
    });
  });
  
  // Extract image from response
  const response = result.response;
  const candidates = response.candidates;
  
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidates returned from Gemini');
  }
  
  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error('No parts in candidate response');
  }
  
  // Find the image part (inlineData)
  const imagePart = parts.find((part: any) => part.inlineData?.data);
  
  if (!imagePart || !imagePart.inlineData?.data) {
    throw new Error('No image data returned from Nano Banana');
  }
  
  // Convert base64 to Buffer
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  return imageBuffer;
}

/**
 * Generate a placeholder SVG image with the prompt text (fallback)
 */
function generatePlaceholderSVG(prompt: string, sceneId: string, variant: number): string {
  const colors = [
    ['#FF6B6B', '#4ECDC4'],
    ['#45B7D1', '#FFA07A'],
    ['#98D8C8', '#F7DC6F'],
    ['#BB8FCE', '#85C1E2'],
    ['#F8B739', '#52C234']
  ];
  
  const colorPair = colors[(variant - 1) % colors.length];
  const truncatedPrompt = prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;
  
  return `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${variant}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorPair[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colorPair[1]};stop-opacity:1" />
        </linearGradient>
        <pattern id="pattern${variant}" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/>
        </pattern>
      </defs>
      
      <rect width="1024" height="1024" fill="url(#grad${variant})"/>
      <rect width="1024" height="1024" fill="url(#pattern${variant})"/>
      
      <text x="512" y="450" font-family="Arial, sans-serif" font-size="28" fill="white" 
            text-anchor="middle" font-weight="bold" opacity="0.9">
        ${sceneId}
      </text>
      
      <text x="512" y="490" font-family="Arial, sans-serif" font-size="20" fill="white" 
            text-anchor="middle" opacity="0.7">
        Variant ${variant}
      </text>
      
      <foreignObject x="100" y="520" width="824" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          color: white;
          font-family: Arial, sans-serif;
          font-size: 16px;
          text-align: center;
          line-height: 1.5;
          opacity: 0.8;
          word-wrap: break-word;
        ">
          ${truncatedPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
      </foreignObject>
      
      <text x="512" y="980" font-family="Arial, sans-serif" font-size="14" fill="white" 
            text-anchor="middle" opacity="0.5">
        Generated: ${new Date().toISOString()}
      </text>
    </svg>
  `;
}

/**
 * Generate and upload an image to GCS
 */
export async function generateAndUploadImage(
  sceneId: string,
  prompt: string,
  variant: number
): Promise<{ url: string; thumbnailUrl?: string }> {
  try {
    logger.info({ sceneId, prompt: prompt.substring(0, 50), variant }, 'Generating image with Nano Banana');
    
    let imageBuffer: Buffer;
    let mimeType: string = 'image/png';
    
    // Check if we should use real Gemini API or placeholder
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'test-api-key' && env.RUN_MODE === 'live') {
      try {
        // Use Nano Banana (Gemini 2.5 Flash Image) to generate real image
        logger.info({ sceneId, variant }, 'Calling Gemini 2.5 Flash Image API (Nano Banana)');
        imageBuffer = await generateNanoBananaImage(prompt);
        logger.info({ sceneId, variant, size: imageBuffer.length }, 'Successfully generated image with Nano Banana');
      } catch (geminiError: any) {
        logger.warn({ error: geminiError.message, sceneId, variant }, 'Nano Banana generation failed, using placeholder');
        // Fall back to placeholder
        const svg = generatePlaceholderSVG(prompt, sceneId, variant);
        imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      }
    } else {
      // Use placeholder SVG for testing or dry run
      logger.info({ sceneId, variant }, 'Using placeholder image (dry run mode or test API key)');
      const svg = generatePlaceholderSVG(prompt, sceneId, variant);
      imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    }
    
    // Generate thumbnail (128px)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(128, 128, { fit: 'cover' })
      .png()
      .toBuffer();
    
    // Upload main image
    const mainImagePath = `images/${sceneId}/variant_${variant}.png`;
    const mainResult = await putObject(
      imageBuffer,
      mimeType,
      mainImagePath
    );
    
    // Upload thumbnail
    const thumbnailPath = `images/${sceneId}/variant_${variant}_thumb.png`;
    const thumbnailResult = await putObject(
      thumbnailBuffer,
      'image/png',
      thumbnailPath
    );
    
    logger.info({ sceneId, variant, mainUrl: mainResult.signedUrl, thumbnailUrl: thumbnailResult.signedUrl }, 'Image generated and uploaded');
    
    return {
      url: mainResult.signedUrl,
      thumbnailUrl: thumbnailResult.signedUrl
    };
    
  } catch (error) {
    logger.error({ error, sceneId, variant }, 'Failed to generate/upload image');
    throw error;
  }
}