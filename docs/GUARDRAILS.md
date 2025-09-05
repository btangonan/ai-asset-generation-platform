# AI Model Guardrails and Safety Controls

Technical specifications and safety measures for the AI asset generation platform.

## 🎯 Overview

This document defines hard constraints, model specifications, and safety controls that MUST be enforced at the API boundary. These guardrails prevent cost overruns, ensure model compliance, and maintain system stability.

## 🔒 Core Safety Principles

### Manual-Only Operation
- **No auto-spend**: All generation requires human confirmation
- **Cost visibility**: Estimates shown before every operation
- **Explicit confirmation**: Users must type "CONFIRM" for live runs
- **Dry-run default**: All operations default to simulation mode

### Defense in Depth
- **Client validation**: Apps Script validates before sending
- **Server validation**: API validates all inputs with Zod
- **Model validation**: Clients enforce model-specific constraints
- **Rate limiting**: Multiple layers prevent abuse

## 🤖 Model Specifications

### Gemini 2.5 Flash Image ("Nano Banana")

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**Supported Parameters**:
```typescript
interface GeminiImageRequest {
  prompt: string;                    // 1-1000 characters
  referenceImages: string[];         // 0-10 image URLs
  variants: 1 | 2 | 3;              // Fixed options
}
```

**Prohibited Parameters**:
- ❌ `fps` - Not applicable to image generation
- ❌ `duration` - Not applicable to image generation  
- ❌ `resolution` - Controlled by model defaults
- ❌ `aspectRatio` - Controlled by reference images

**Output Specifications**:
- Format: PNG, sRGB color space
- Dimensions: Typically 1024x1024 (model-controlled)
- Quality: High-resolution suitable for Veo seeding
- Count: 1-3 variants per request

**Rate Limits**:
- Requests: 1000 per day (per project)
- Images: 3000 per day (per project)  
- Concurrent: 10 requests max

**Cost**: $0.002 per generated image

### Veo 3 Models (Phase 2)

**Veo 3 Preview**: `projects/{project}/locations/{location}/publishers/google/models/veo-3.0-generate-preview`
**Veo 3 Fast**: `projects/{project}/locations/{location}/publishers/google/models/veo-3.0-fast-generate-001`

**Mandatory Parameters** (Hard Constraints):
```typescript
interface VeoVideoRequest {
  prompt: string;                    // 1-1000 characters
  seedImage: string;                 // Required GCS URL
  aspect: '16:9' | '9:16';          // ONLY these values
  resolution: 720 | 1080;           // ONLY these values
  duration: 8;                       // LOCKED to 8 seconds
  fps: 24;                          // LOCKED to 24 fps
}
```

**Prohibited Values**:
- ❌ Any `aspect` other than 16:9 or 9:16
- ❌ Any `resolution` other than 720 or 1080
- ❌ Any `duration` other than 8 seconds
- ❌ Any `fps` other than 24

**Output Specifications**:
- Format: MP4, H.264 encoding
- Duration: Exactly 8.0 seconds
- Quality: Production-ready
- Max per request: 2 (Veo 3), 4 (Veo 3 Fast)

**Rate Limits**:
- RPM: 10 requests per minute (per project)
- Daily: 1000 requests per day
- Concurrent: 2 requests max

**Cost**: 
- Veo 3 Preview: $0.50 per 8-second video
- Veo 3 Fast: $0.10 per 8-second video

## ⚡ Rate Limiting Controls

### User-Level Limits

**Image Generation**:
```typescript
const imageLimits = {
  batchFrequency: {
    limit: 1,
    window: 10 * 60 * 1000,        // 10 minutes
    message: "Please wait 10 minutes between image batches"
  },
  batchSize: {
    limit: 10,                      // Max rows per batch
    message: "Maximum 10 rows per batch"
  },
  variantsPerRow: {
    limit: 3,                       // Max variants per scene
    message: "Maximum 3 variants per scene"
  }
};
```

**Video Generation** (Phase 2):
```typescript
const videoLimits = {
  batchFrequency: {
    limit: 1,
    window: 30 * 60 * 1000,        // 30 minutes
    message: "Please wait 30 minutes between video batches"
  },
  batchSize: {
    limit: 4,                       // Max videos per batch (Veo 3 Fast limit)
    message: "Maximum 4 videos per batch"
  }
};
```

### Project-Level Limits

**Daily Budgets**:
```typescript
const budgetControls = {
  daily: {
    images: 1000,                   // $2000 max per day
    videos: 200,                    // $100 max per day  
    total: 1000                     // $1000 total daily cap
  },
  emergency: {
    killSwitch: true,               // Global disable if exceeded
    alertThreshold: 0.8             // Alert at 80% of budget
  }
};
```

## 🛡️ Input Validation

### Scene ID Requirements
```typescript
const sceneIdSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9-_]+$/, "Only alphanumeric, hyphens, and underscores allowed");
```

### Prompt Requirements
```typescript
const promptSchema = z.string()
  .min(10, "Prompts must be at least 10 characters")
  .max(1000, "Prompts must not exceed 1000 characters")
  .refine(prompt => !containsProfanity(prompt), "Inappropriate content detected")
  .refine(prompt => !containsCopyrighted(prompt), "Copyrighted content detected");
```

### Reference Pack Validation
```typescript
const refPackSchema = z.string()
  .url("Must be a valid URL")
  .refine(url => url.startsWith('https://storage.googleapis.com/'), "Must be GCS URL")
  .refine(async url => await isAccessible(url), "URL must be accessible");
```

## 💰 Cost Controls

### Pre-Generation Estimation
```typescript
class CostCalculator {
  estimateImageBatch(items: ImageBatchItem[]): number {
    const totalImages = items.reduce((sum, item) => sum + item.variants, 0);
    return totalImages * 0.002; // $0.002 per image
  }

  estimateVideoBatch(items: VideoBatchItem[]): number {
    return items.reduce((sum, item) => {
      const rate = item.veo_model === 'veo3' ? 0.50 : 0.10;
      return sum + rate;
    }, 0);
  }

  // Must show estimate and require confirmation for amounts > $1
  requiresConfirmation(cost: number): boolean {
    return cost > 1.00;
  }
}
```

### Budget Enforcement
```typescript
async function validateBudget(estimatedCost: number): Promise<void> {
  const dailySpend = await getDailySpend();
  const projectedSpend = dailySpend + estimatedCost;
  
  if (projectedSpend > DAILY_BUDGET) {
    throw new QuotaExceededError(
      `Would exceed daily budget: $${projectedSpend} > $${DAILY_BUDGET}`,
      'DAILY_BUDGET'
    );
  }
}
```

## 🔄 Idempotency Controls

### Job ID Generation
```typescript
function generateJobId(sceneId: string, model: string, inputs: Record<string, any>): string {
  const dayBucket = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const inputHash = createHash('sha256')
    .update(JSON.stringify(inputs, Object.keys(inputs).sort()))
    .digest('hex')
    .substring(0, 16);
    
  return createHash('sha256')
    .update(`${sceneId}:${model}:${inputHash}:${dayBucket}`)
    .digest('hex');
}
```

### Duplicate Prevention
```typescript
const jobCache = new Map<string, { timestamp: number; status: string }>();

async function preventDuplicateJob(jobId: string): Promise<void> {
  const existing = jobCache.get(jobId);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  if (existing && (now - existing.timestamp) < dayMs) {
    throw new ValidationError(
      `Duplicate job detected. Job ${jobId} was submitted ${Math.round((now - existing.timestamp) / 60000)} minutes ago`,
      { jobId, status: existing.status }
    );
  }
}
```

## 🚨 Error Handling

### Model-Specific Errors
```typescript
// Veo constraint violations
if (request.duration !== 8) {
  throw new ValidationError(
    "Veo duration must be exactly 8 seconds",
    { provided: request.duration, required: 8 }
  );
}

if (!['16:9', '9:16'].includes(request.aspect)) {
  throw new ValidationError(
    "Veo aspect ratio must be 16:9 or 9:16",
    { provided: request.aspect, allowed: ['16:9', '9:16'] }
  );
}

// Gemini image constraint violations
if ('fps' in request || 'duration' in request) {
  throw new ValidationError(
    "fps and duration parameters not supported for image generation",
    { unsupportedParams: Object.keys(request).filter(k => ['fps', 'duration'].includes(k)) }
  );
}
```

### Quota Exhaustion Handling
```typescript
async function handleQuotaExceeded(error: any, service: string): Promise<never> {
  if (error.status === 429) {
    const retryAfter = error.headers?.['retry-after'] || 60;
    
    throw new QuotaExceededError(
      `${service} quota exceeded. Try again in ${retryAfter} seconds.`,
      service,
      { retryAfterSeconds: retryAfter }
    );
  }
  
  throw error;
}
```

## 📊 Monitoring and Alerting

### Critical Alerts
- Budget exceeded 80% of daily limit
- Error rate > 5% over 10 minutes
- Queue backlog > 50 pending jobs
- Model API errors > 10% over 5 minutes

### Metrics to Track
```typescript
const metrics = {
  requests: {
    total: 'counter',
    errors: 'counter', 
    duration: 'histogram'
  },
  costs: {
    daily: 'gauge',
    perUser: 'counter',
    perModel: 'counter'
  },
  quotas: {
    remaining: 'gauge',
    resetTime: 'gauge'
  }
};
```

## ✅ Enforcement Checklist

### API Gateway Level
- [ ] Rate limiting configured
- [ ] Request size limits (10MB max)
- [ ] Timeout limits (5 minutes max)
- [ ] CORS restrictions

### Application Level
- [ ] Zod schema validation on all inputs
- [ ] Model constraint enforcement
- [ ] Cost estimation and approval
- [ ] Idempotency checking
- [ ] Budget tracking and limits

### Infrastructure Level
- [ ] Cloud Run concurrency limits
- [ ] Pub/Sub message retention
- [ ] GCS lifecycle policies
- [ ] IAM minimal permissions

These guardrails are non-negotiable and must be maintained across all code changes and deployments.