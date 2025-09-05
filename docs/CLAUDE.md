# Claude Code Development Guide

## Project Overview

AI Asset Generation Platform for converting Google Sheets data into AI-generated images and videos. Built with TypeScript, Fastify, Google Cloud, and a future-proofed architecture.

## Quick Start

```bash
# Install and build
pnpm install && pnpm build

# Run locally  
pnpm dev

# Test
pnpm test

# Deploy
gcloud builds submit --config=infra/cloudbuild.yaml
```

## Architecture Principles

### Core Design
- **Backend**: Fastify on Cloud Run, Pub/Sub workers, GCS storage
- **Frontend**: Google Sheets + Apps Script (Phase 1) → React Web App (Phase 2)
- **State**: Sheets as UI, optional Firestore for job persistence
- **Models**: Gemini 2.5 Flash Image (Phase 1), Veo 3/Fast (Phase 2)

### Key Patterns
- **Future-proofed**: All video columns present but disabled in Phase 1
- **Manual-only**: No auto-spend, explicit confirmation required
- **Batch-first**: All operations designed for bulk processing
- **Async decoupled**: Pub/Sub prevents UI blocking on long operations

## Development Rules

### ✅ Do
- **Maintain future compatibility**: Don't remove video-related fields/schemas
- **Enforce model specs**: Hard reject unsupported Veo/Gemini parameters
- **Use structured logging**: Include requestId, jobId, sceneId, user, cost
- **Batch Sheets operations**: Use `batchUpdate()` to avoid quota issues
- **Validate everything server-side**: Never trust client input
- **Keep Apps Script minimal**: Single POST per action, no business logic

### ❌ Don't
- **Don't put business logic in Apps Script**: Keep UI ultra-thin
- **Don't bypass guardrails**: All safety checks must be enforced
- **Don't break idempotency**: `job_id = hash(scene_id + inputs + day_bucket)`
- **Don't ignore rate limits**: Implement exponential backoff everywhere
- **Don't commit secrets**: Use Secret Manager or environment variables
- **Don't skip error handling**: Every external call needs try/catch + retry

## Code Standards

### File Organization
```
apps/orchestrator/
├─ src/routes/          # API endpoints
├─ src/workers/         # Pub/Sub consumers
├─ src/lib/            # Utilities (logger, cost, auth)
└─ src/clients/        # External service wrappers

packages/
├─ shared/             # Types, schemas, errors
├─ clients/            # AI model clients
└─ sheets/             # Google Sheets helpers
```

### Schema Patterns
```typescript
// Always use Zod for validation
export const ImageBatchItemSchema = z.object({
  scene_id: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
  variants: z.number().int().min(1).max(3),
});

// Future-proof with literal constraints
export const VideoBatchItemSchema = z.object({
  duration_s: z.literal(8),    // Hard constraint
  fps: z.literal(24),          // Hard constraint
});
```

### Error Handling
```typescript
// Structured errors with codes
export class RateLimitError extends AIAssetError {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message, 'RATE_LIMITED', 429);
  }
}

// Exponential backoff pattern
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

## Model Integration Guidelines

### Gemini 2.5 Flash Image (Phase 1)
```typescript
// Correct usage
await geminiClient.generateImages({
  prompt: "cinematic kitchen scene",
  refPackUrls: ["https://storage.googleapis.com/..."],
  variants: 3
});

// ❌ Wrong - no video params for images
// duration, fps, resolution not supported
```

### Veo 3 Constraints (Phase 2)
```typescript
// Hard constraints - reject anything else
const VeoConstraints = {
  aspect: ['16:9', '9:16'],      // Only these ratios
  resolution: [720, 1080],       // Only these resolutions  
  duration_s: 8,                 // Fixed duration
  fps: 24,                       // Fixed frame rate
  maxOutputs: { veo3: 2, veo3_fast: 4 }
};
```

## Testing Guidelines

### Unit Tests
```typescript
// Test schemas thoroughly
describe('ImageBatchItemSchema', () => {
  it('should accept valid input', () => {
    const result = ImageBatchItemSchema.parse({
      scene_id: 'TEST-001',
      prompt: 'A beautiful sunset',
      variants: 2
    });
    expect(result).toBeDefined();
  });
});
```

### E2E Tests
```typescript
// Test complete workflows
describe('Image Generation Flow', () => {
  it('should process batch from request to completion', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/batch/images',
      payload: { items: mockItems, runMode: 'live' }
    });
    
    expect(response.statusCode).toBe(202);
    // Verify job created, Pub/Sub message sent, etc.
  });
});
```

## Security Requirements

### Authentication
- Use Application Default Credentials (ADC) on Cloud Run
- Service account with minimal required permissions
- No API keys in code - use Secret Manager

### Data Protection
- Generate signed URLs for all GCS assets (7-day expiry)
- Redact PII from logs
- Validate and sanitize all user input
- Use HTTPS everywhere

### Rate Limiting
```typescript
// Per-user cooldown
const rateLimits = {
  imageGeneration: { cooldown: 10, unit: 'minutes' },
  dailyBudget: { limit: 100, unit: 'USD' },
  batchSize: { max: 10, unit: 'rows' }
};
```

## Performance Optimization

### Parallel Processing
```typescript
// Good - parallel image generation
const jobs = items.map(item => generateImage(item));
const results = await Promise.allSettled(jobs);

// Bad - sequential processing
for (const item of items) {
  await generateImage(item); // Blocks unnecessarily
}
```

### Caching Strategy
```typescript
// Cache expensive operations
const signedUrl = await cache.get(gcsPath) || 
  await gcs.getSignedUrl(gcsPath, { expires: '7d' });
```

## Migration Path (Phase 1 → Phase 2)

### What Stays the Same
- Sheet schema (all columns already present)
- GCS storage structure (`images/` + `videos/` parallel)
- API contracts (just enable stubbed routes)
- Apps Script UI patterns

### What Changes
- Replace video route stub with implementation
- Add Vertex Veo client integration
- Enable video menu items in Apps Script
- Add Firestore for job state management

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing (`pnpm test`)
- [ ] Linting clean (`pnpm lint`)
- [ ] Type checking (`pnpm typecheck`)
- [ ] Environment variables configured
- [ ] Service account permissions verified

### Post-deployment
- [ ] Health check returns 200 (`/healthz`)
- [ ] Can create dry-run batch
- [ ] Pub/Sub subscription active
- [ ] GCS bucket accessible
- [ ] Monitoring/alerting configured

## Troubleshooting

### Common Issues

**Apps Script timeout (6-minute limit)**
```javascript
// Keep UI calls minimal - single POST only
function generateImagesLive() {
  const payload = buildPayload(getSelectedRows());
  UrlFetchApp.fetch(API_URL + '/batch/images', { 
    method: 'POST', 
    payload: JSON.stringify(payload) 
  });
  // Exit immediately - no loops or retries
}
```

**Sheets API rate limits (429 errors)**
```typescript
// Batch all updates together
await sheets.batchUpdate({
  valueInputOption: 'RAW',
  data: allUpdates // Multiple rows in single call
});
```

**Memory issues with large images**
```typescript
// Stream uploads to GCS, don't buffer in memory
const uploadStream = gcs.bucket(bucket).file(fileName).createWriteStream();
await pipeline(imageBuffer, uploadStream);
```

## Development Workflow

1. **Feature Branch**: Create from `main`
2. **Implement**: Follow schema-first development
3. **Test**: Unit + integration tests required
4. **Document**: Update relevant docs
5. **Review**: PR with deployment checklist
6. **Deploy**: Via Cloud Build pipeline

This guide ensures consistent, maintainable code that scales from MVP to production.