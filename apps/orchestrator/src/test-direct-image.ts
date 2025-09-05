import { GeminiImageClient } from '@ai-platform/clients';
import { putObject, makeThumb, generateSignedUrl } from './lib/gcs.js';
import { env } from './lib/env.js';

async function testDirectImageGeneration() {
  console.log('Testing direct image generation...');
  console.log('Using project:', env.GOOGLE_CLOUD_PROJECT);
  console.log('Using bucket:', env.GCS_BUCKET);
  
  // Initialize Gemini client with GCS operations
  const gcsOps = {
    uploadImage: putObject,
    makeThumb,
    getSignedUrl: generateSignedUrl,
  };
  
  const geminiClient = new GeminiImageClient(env.GEMINI_API_KEY, gcsOps);
  
  try {
    console.log('Generating image with Gemini...');
    const result = await geminiClient.generateImages({
      prompt: 'A modern minimalist kitchen with morning sunlight streaming through large windows, marble countertops, wooden cabinets, and a bowl of fresh fruit on the island. Photorealistic architectural photography, high quality, 4K resolution.',
      refPackUrls: [],
      variants: 1,
      sceneId: 'TEST-001',
      jobId: 'test-job-001',
    });
    
    console.log('Success! Generated images:', result);
    
    if (result.images && result.images.length > 0) {
      console.log('\n✅ Image generated successfully!');
      console.log('Full resolution image:', result.images[0].url);
      console.log('Thumbnail:', result.images[0].thumbnailUrl);
      console.log('\nYou can view the images at these URLs (valid for 7 days)');
    }
  } catch (error) {
    console.error('Failed to generate image:', error);
  }
}

testDirectImageGeneration();