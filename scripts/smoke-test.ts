#!/usr/bin/env tsx

/**
 * Smoke test script to verify the deployable skeleton
 * Tests basic functionality without external dependencies
 */

import { exit } from 'process';

async function runSmokeTest(): Promise<void> {
  console.log('🧪 Running smoke tests for AI Asset Generation Platform...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  const test = async (name: string, testFn: () => Promise<void> | void) => {
    try {
      console.log(`⏳ ${name}`);
      await testFn();
      console.log(`✅ ${name}\n`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.error(`   Error: ${error}\n`);
      testsFailed++;
    }
  };

  // Test 1: Environment schema validation
  await test('Environment schema validation', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.GCS_BUCKET = 'test-bucket';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    
    // Dynamic import to test the module
    const { env } = await import('../apps/orchestrator/src/lib/env.js');
    
    if (env.PORT !== 9090) throw new Error('Default PORT should be 9090 (overridden by environment)');
    if (env.RUN_MODE !== 'dry_run') throw new Error('Default RUN_MODE should be dry_run');
  });

  // Test 2: Zod schemas validation
  await test('Zod schemas validation', async () => {
    const { ImageBatchRequestSchema } = await import('@ai-platform/shared');
    
    const validRequest = {
      items: [
        {
          scene_id: 'SMOKE-001',
          prompt: 'Test prompt for smoke test',
          ref_pack_public_url: 'https://storage.googleapis.com/test/refs',
          variants: 2,
        },
      ],
      runMode: 'dry_run' as const,
    };
    
    const result = ImageBatchRequestSchema.parse(validRequest);
    if (result.items.length !== 1) throw new Error('Schema validation failed');
  });

  // Test 3: Cost calculator
  await test('Cost calculator functionality', async () => {
    const { CostCalculator } = await import('../apps/orchestrator/src/lib/cost.js');
    
    const calculator = new CostCalculator();
    const mockItems = [
      {
        scene_id: 'TEST',
        prompt: 'Test',
        ref_pack_public_url: 'https://test.com',
        variants: 3,
      },
    ];
    
    const cost = calculator.estimateImageBatch(mockItems);
    if (cost !== 0.006) throw new Error(`Expected cost 0.006, got ${cost}`);
  });

  // Test 4: Gemini client mock functionality
  await test('Gemini client mock functionality', async () => {
    const { GeminiImageClient } = await import('@ai-platform/clients');
    
    const client = new GeminiImageClient('test-key');
    const result = await client.generateImages({
      prompt: 'Test prompt',
      refPackUrls: ['https://storage.googleapis.com/test/ref.png'],
      variants: 2,
      sceneId: 'SMOKE-001',
      jobId: 'smoke-job-001',
    });
    
    if (result.images.length !== 2) throw new Error('Should generate 2 mock images');
    if (!result.images[0].gcsUri.includes('SMOKE-001')) throw new Error('GCS URI should include scene ID');
  });

  // Test 5: GCS client structure
  await test('GCS client path generation', async () => {
    const { GCSClient } = await import('@ai-platform/clients');
    
    const imagePath = GCSClient.generateImagePath('campaign1', 'scene1', 'job1', 1);
    const expectedPath = 'images/campaign1/scene1/job1/var_1.png';
    
    if (imagePath !== expectedPath) throw new Error(`Expected ${expectedPath}, got ${imagePath}`);
    
    const videoPath = GCSClient.generateVideoPath('campaign1', 'scene1', 'job1');
    const expectedVideoPath = 'videos/campaign1/scene1/job1/clip_1.mp4';
    
    if (videoPath !== expectedVideoPath) throw new Error(`Expected ${expectedVideoPath}, got ${videoPath}`);
  });

  // Test 6: Future-proofing - Video schemas ready
  await test('Video schema future-proofing', async () => {
    const { VideoBatchItemSchema } = await import('@ai-platform/shared');
    
    const validVideoItem = {
      scene_id: 'VIDEO-001',
      prompt: 'Test video prompt',
      approved_image_url: 'https://storage.googleapis.com/test/approved.png',
      veo_model: 'veo3_fast' as const,
      aspect: '16:9' as const,
      resolution: 720 as const,
      duration_s: 8 as const,
      fps: 24 as const,
    };
    
    const result = VideoBatchItemSchema.parse(validVideoItem);
    if (result.duration_s !== 8) throw new Error('Duration should be locked to 8');
    if (result.fps !== 24) throw new Error('FPS should be locked to 24');
  });

  // Summary
  console.log('📊 Smoke Test Results:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  
  if (testsFailed > 0) {
    console.log('\n🚨 Some smoke tests failed. Please fix issues before deployment.');
    exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed! Skeleton is ready for deployment.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Set up Google Cloud project and services');
    console.log('   2. Configure environment variables');
    console.log('   3. Deploy with: gcloud builds submit --config=infra/cloudbuild.yaml');
    console.log('   4. Set up Google Sheet with template and Apps Script');
    exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTest().catch((error) => {
    console.error('❌ Smoke test runner failed:', error);
    exit(1);
  });
}

export { runSmokeTest };