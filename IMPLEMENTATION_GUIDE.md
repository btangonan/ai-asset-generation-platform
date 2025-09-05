# Implementation Guide: Completing Phase 1

This guide provides step-by-step instructions to complete the missing components and make the AI Asset Generation Platform production-ready.

## 🎯 Goal: Production-Ready Image Generation

Transform the current mock implementation into a fully functional image generation pipeline using Gemini 2.5 Flash.

---

## Step 1: Implement Real Gemini API Client (Day 1-3)

### File: `/packages/clients/src/gemini-image-client.ts`

Replace the mock implementation (lines 38-84) with:

```typescript
import { Storage } from '@google-cloud/storage';

export class GeminiImageClient {
  private storage: Storage;
  
  constructor(
    private apiKey: string,
    private projectId: string,
    private bucketName: string
  ) {
    this.storage = new Storage({ projectId });
  }

  async generateImages(request: GenerateImagesRequest): Promise<GenerateImagesResponse> {
    const { prompt, ref_pack_public_url, variants, scene_id, job_id } = request;
    
    const images: ImageOutput[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < variants; i++) {
      try {
        // Step 1: Generate image with Gemini
        const imageData = await this.callGeminiAPI(prompt, ref_pack_public_url);
        
        // Step 2: Upload to GCS
        const gcsPath = `images/${scene_id}/${job_id}/var_${i + 1}.png`;
        const publicUrl = await this.uploadToGCS(imageData, gcsPath);
        
        // Step 3: Generate thumbnail
        const thumbnailUrl = await this.generateThumbnail(publicUrl);
        
        images.push({
          variantId: `var_${i + 1}`,
          url: publicUrl,
          thumbnailUrl,
          metadata: {
            width: 1024,
            height: 1024,
            format: 'png',
            sizeBytes: imageData.length
          }
        });
      } catch (error) {
        errors.push(`Variant ${i + 1}: ${error.message}`);
      }
    }
    
    return {
      jobId: job_id,
      sceneId: scene_id,
      images,
      errors: errors.length > 0 ? errors : undefined,
      status: images.length > 0 ? 'completed' : 'failed'
    };
  }
  
  private async callGeminiAPI(prompt: string, refUrl?: string): Promise<Buffer> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              ...(refUrl ? [{ fileData: { fileUri: refUrl } }] : [])
            ]
          }],
          generationConfig: {
            responseMimeType: 'image/png',
            responseMode: 'image'
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const base64Image = data.candidates[0].content.parts[0].inlineData.data;
    return Buffer.from(base64Image, 'base64');
  }
  
  private async uploadToGCS(imageData: Buffer, path: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(path);
    
    await file.save(imageData, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    // Generate signed URL (7 days expiry)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    
    return signedUrl;
  }
  
  private async generateThumbnail(imageUrl: string): Promise<string> {
    // For now, return the same URL
    // Later: implement thumbnail generation with Sharp or Cloud Functions
    return imageUrl;
  }
}
```

---

## Step 2: Create Pub/Sub Worker (Day 4-5)

### New File: `/apps/orchestrator/src/workers/image-processor.ts`

```typescript
import { PubSub } from '@google-cloud/pubsub';
import { GeminiImageClient } from '@ai-platform/clients';
import { SheetsClient } from '@ai-platform/sheets';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const pubsub = new PubSub({ projectId: env.GOOGLE_CLOUD_PROJECT });
const subscription = pubsub.subscription('image-generation-sub');

const geminiClient = new GeminiImageClient(
  env.GEMINI_API_KEY,
  env.GOOGLE_CLOUD_PROJECT,
  env.GCS_BUCKET
);

const sheetsClient = new SheetsClient(
  env.GOOGLE_SHEETS_API_KEY,
  env.GOOGLE_SHEETS_ID
);

export async function startWorker() {
  subscription.on('message', async (message) => {
    const startTime = Date.now();
    const jobData = JSON.parse(message.data.toString());
    
    logger.info({ jobId: jobData.job_id }, 'Processing image job');
    
    try {
      // Step 1: Generate images
      const result = await geminiClient.generateImages(jobData);
      
      // Step 2: Update sheet with results
      await sheetsClient.updateRow(jobData.scene_id, {
        status_img: 'completed',
        nano_img_1: result.images[0]?.thumbnailUrl || '',
        nano_img_2: result.images[1]?.thumbnailUrl || '',
        nano_img_3: result.images[2]?.thumbnailUrl || '',
        job_id: jobData.job_id
      });
      
      // Step 3: Acknowledge message
      message.ack();
      
      const duration = Date.now() - startTime;
      logger.info({ jobId: jobData.job_id, duration }, 'Job completed');
      
    } catch (error) {
      logger.error({ jobId: jobData.job_id, error }, 'Job failed');
      
      // Update sheet with error
      await sheetsClient.updateRow(jobData.scene_id, {
        status_img: 'failed',
        job_id: jobData.job_id
      });
      
      // Retry or dead-letter based on attempt count
      if (message.deliveryAttempt > 3) {
        message.ack(); // Give up after 3 attempts
      } else {
        message.nack(); // Retry
      }
    }
  });
  
  subscription.on('error', (error) => {
    logger.error({ error }, 'Subscription error');
  });
  
  logger.info('Image processing worker started');
}

// Start worker if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    logger.error({ error }, 'Worker startup failed');
    process.exit(1);
  });
}
```

### New File: `/apps/orchestrator/src/workers/index.ts`

```typescript
import { startWorker } from './image-processor.js';

// Export for use in main app
export { startWorker };

// Can be run standalone
if (process.env.RUN_WORKER === 'true') {
  startWorker();
}
```

---

## Step 3: Connect Pub/Sub Publishing (Day 5)

### Update: `/apps/orchestrator/src/routes/images.ts`

Replace the TODO section (around line 86) with:

```typescript
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({ projectId: env.GOOGLE_CLOUD_PROJECT });
const topic = pubsub.topic('image-generation');

// Inside the POST handler, replace the TODO with:
if (runMode === 'live') {
  // Publish jobs to Pub/Sub
  const publishPromises = jobs.map(async (job) => {
    const messageData = {
      job_id: job.jobId,
      scene_id: job.sceneId,
      prompt: job.prompt,
      ref_pack_public_url: job.refPackUrl,
      variants: job.variants,
      timestamp: new Date().toISOString()
    };
    
    const messageId = await topic.publishMessage({
      json: messageData,
      attributes: {
        batchId,
        userId,
        runMode
      }
    });
    
    fastify.log.info({ jobId: job.jobId, messageId }, 'Job published to Pub/Sub');
  });
  
  await Promise.all(publishPromises);
}
```

---

## Step 4: Add Authentication (Day 6)

### New File: `/apps/orchestrator/src/lib/auth.ts`

```typescript
import { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export function extractUser(request: FastifyRequest): AuthUser {
  // Option 1: JWT from Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
      return decoded;
    } catch (error) {
      // Invalid token
    }
  }
  
  // Option 2: Session cookie (for web UI)
  const sessionId = request.cookies?.sessionId;
  if (sessionId) {
    // Look up session in Redis/Firestore
    // Return user data
  }
  
  // Option 3: API Key (for service accounts)
  const apiKey = request.headers['x-api-key'];
  if (apiKey) {
    // Validate API key
    // Return service account user
  }
  
  // Default: anonymous user with limited access
  return {
    userId: 'anonymous',
    email: 'anonymous@example.com',
    role: 'user'
  };
}

export function requireAuth(request: FastifyRequest): AuthUser {
  const user = extractUser(request);
  if (user.userId === 'anonymous') {
    throw new Error('Authentication required');
  }
  return user;
}
```

### Update: `/apps/orchestrator/src/routes/images.ts`

Replace line 46:
```typescript
import { requireAuth } from '../lib/auth.js';

// In the POST handler:
const user = requireAuth(request);
const userId = user.userId;
```

---

## Step 5: Infrastructure Setup (Day 7-8)

### Create: `/infra/terraform/pubsub.tf`

```hcl
resource "google_pubsub_topic" "image_generation" {
  name = "image-generation"
  
  message_retention_duration = "86400s" # 1 day
  
  schema_settings {
    schema = google_pubsub_schema.image_job.id
    encoding = "JSON"
  }
}

resource "google_pubsub_subscription" "image_generation_sub" {
  name  = "image-generation-sub"
  topic = google_pubsub_topic.image_generation.id
  
  ack_deadline_seconds = 600 # 10 minutes for image generation
  
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
  
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
  
  push_config {
    push_endpoint = "${google_cloud_run_service.orchestrator.status[0].url}/webhook/job-complete"
    
    oidc_token {
      service_account_email = google_service_account.orchestrator.email
    }
  }
}

resource "google_pubsub_schema" "image_job" {
  name = "image-job-schema"
  type = "AVRO"
  definition = file("schemas/image-job.avsc")
}
```

### Create: `/scripts/deploy.sh`

```bash
#!/bin/bash
set -e

PROJECT_ID="solid-study-467023-i3"
REGION="us-central1"
SERVICE_NAME="ai-orchestrator"

echo "🚀 Deploying AI Asset Generation Platform"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME} ./apps/orchestrator
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-env-vars "GCS_BUCKET=${PROJECT_ID}-ai-assets" \
  --set-env-vars "RUN_MODE=live" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --service-account orchestrator@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10

# Deploy worker (separate service)
echo "👷 Deploying worker..."
gcloud run deploy ${SERVICE_NAME}-worker \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --region ${REGION} \
  --platform managed \
  --no-allow-unauthenticated \
  --set-env-vars "RUN_WORKER=true" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-env-vars "GCS_BUCKET=${PROJECT_ID}-ai-assets" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --service-account orchestrator@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 5

echo "✅ Deployment complete!"
```

---

## Step 6: Testing & Validation (Day 9)

### Create: `/apps/orchestrator/tests/integration/gemini.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GeminiImageClient } from '@ai-platform/clients';

describe('Gemini Integration', () => {
  it('should generate real image', async () => {
    const client = new GeminiImageClient(
      process.env.GEMINI_API_KEY!,
      process.env.GOOGLE_CLOUD_PROJECT!,
      process.env.GCS_BUCKET!
    );
    
    const result = await client.generateImages({
      scene_id: 'test-001',
      job_id: 'job_test_001',
      prompt: 'A red cube on a white background',
      variants: 1
    });
    
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toMatch(/^https:\/\//);
    expect(result.status).toBe('completed');
  });
});
```

### Manual Testing Checklist

```bash
# 1. Test health endpoint
curl http://localhost:9090/test

# 2. Test dry run mode
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{"items":[{"scene_id":"test","prompt":"test","ref_pack_public_url":"https://example.com","variants":1}],"runMode":"dry_run"}'

# 3. Test live mode (with real Gemini)
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"items":[{"scene_id":"test","prompt":"A blue ocean","ref_pack_public_url":"https://example.com","variants":1}],"runMode":"live"}'

# 4. Check job status
curl http://localhost:9090/status/JOB_ID

# 5. Verify GCS upload
gsutil ls gs://your-bucket/images/

# 6. Check Pub/Sub metrics
gcloud pubsub subscriptions pull image-generation-sub --auto-ack
```

---

## Step 7: Production Checklist (Day 10)

### Pre-Launch Checklist

- [ ] **API Integration**
  - [ ] Gemini API key configured
  - [ ] GCS bucket permissions set
  - [ ] Pub/Sub topics created
  
- [ ] **Security**
  - [ ] Authentication implemented
  - [ ] CORS configured for production
  - [ ] Secrets in Secret Manager
  - [ ] IAM roles configured
  
- [ ] **Infrastructure**
  - [ ] Cloud Run deployed
  - [ ] Worker service running
  - [ ] Monitoring configured
  - [ ] Alerts set up
  
- [ ] **Testing**
  - [ ] Unit tests passing
  - [ ] Integration tests passing
  - [ ] E2E tests passing
  - [ ] Load test completed
  
- [ ] **Documentation**
  - [ ] API documentation updated
  - [ ] Runbook completed
  - [ ] Deployment guide written
  - [ ] User guide created

### Post-Launch Monitoring

```typescript
// Add to orchestrator startup
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const exporter = new PrometheusExporter({ port: 9464 }, () => {
  console.log('Metrics server started on port 9464');
});

const meter = new MeterProvider({
  exporter,
  interval: 2000,
}).getMeter('orchestrator');

// Track metrics
const jobCounter = meter.createCounter('jobs_processed');
const jobDuration = meter.createHistogram('job_duration_seconds');
const errorCounter = meter.createCounter('job_errors');
```

---

## Timeline Summary

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-3 | Gemini Client | Real image generation |
| 4-5 | Pub/Sub Worker | Async processing |
| 6 | Authentication | User isolation |
| 7-8 | Infrastructure | Deployment ready |
| 9 | Testing | Validation complete |
| 10 | Launch | Production live |

## Success Criteria

✅ Real images generated from prompts  
✅ Images stored in GCS with signed URLs  
✅ Jobs processed asynchronously  
✅ Sheet updates automated  
✅ Authentication enforced  
✅ System deployed to Cloud Run  
✅ Monitoring and alerts configured  
✅ All tests passing

---

## Support Resources

- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Cloud Run Guide](https://cloud.google.com/run/docs)
- [Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [GCS Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)

## Questions?

For implementation support, refer to:
- `/docs/RUNBOOK.md` - Operational procedures
- `/docs/GUARDRAILS.md` - Safety guidelines
- `/AUDIT_REPORT.md` - Detailed analysis
- `/STATUS.md` - Current progress