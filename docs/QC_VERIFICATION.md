# QC Verification - Image-Only MVP

**Date**: 2025-01-09  
**Version**: 1.0.0  
**Service**: AI Asset Orchestrator  

## 🔴 CRITICAL FINDING

The actual route is `POST /images`, NOT `POST /batch/images` as specified in requirements.

## A. HTTP Test Commands

### R1: Health Check
```bash
curl -X GET "$API_BASE/healthz"
```
**Expected**: `{"status": "healthy", ...}` ❌ (returns different format, not `{"ok": true}`)

### R2: Schema Validation (variants=4)
```bash
curl -X POST "$API_BASE/images" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "scene_id": "SEQ01-001",
      "prompt": "Warm cinematic kitchen",
      "variants": 4
    }],
    "runMode": "dry_run"
  }'
```

### R3: Dry Run (Valid)
```bash
curl -X POST "$API_BASE/images" \
  -H "Content-Type: application/json" \
  -H "X-Sheet-Id: test-sheet-123" \
  -d '{
    "items": [
      {
        "scene_id": "SEQ01-001",
        "prompt": "Warm cinematic kitchen, morning backlight.",
        "ref_pack_public_urls": [
          "https://storage.googleapis.com/ref1.png",
          "https://storage.googleapis.com/ref2.png"
        ],
        "variants": 2
      },
      {
        "scene_id": "SEQ01-002",
        "prompt": "Warm cinematic kitchen, morning backlight.",
        "ref_pack_public_urls": [
          "https://storage.googleapis.com/ref1.png",
          "https://storage.googleapis.com/ref2.png"
        ],
        "variants": 2
      }
    ],
    "runMode": "dry_run"
  }'
```

### R4: Live Enqueue
```bash
curl -X POST "$API_BASE/images" \
  -H "Content-Type: application/json" \
  -H "X-Sheet-Id: test-sheet-123" \
  -d '{
    "items": [
      {
        "scene_id": "SEQ01-001",
        "prompt": "Warm cinematic kitchen, morning backlight.",
        "ref_pack_public_urls": [
          "https://storage.googleapis.com/ref1.png",
          "https://storage.googleapis.com/ref2.png"
        ],
        "variants": 2
      },
      {
        "scene_id": "SEQ01-002",
        "prompt": "Warm cinematic kitchen, morning backlight.",
        "ref_pack_public_urls": [
          "https://storage.googleapis.com/ref1.png",
          "https://storage.googleapis.com/ref2.png"
        ],
        "variants": 2
      }
    ],
    "runMode": "live"
  }' | jq '.'
```

### R8: Idempotency Test
```bash
# Run R4 twice within 30 seconds
# Second response should show cached=true or message about existing job
```

### R9: Rate Limit Test  
```bash
# Run R4
# Wait 30 seconds
# Run again with different scene_ids (SEQ01-003, SEQ01-004)
# Second request should be rejected with cooldown message
```

## B. Expected JSON Responses

### Success (R1) - ACTUAL
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T...",
  "service": "ai-asset-orchestrator",
  "version": "1.0.0"
}
```

### Validation Error (R2)
```json
{
  "error": "INVALID_VARIANTS",
  "message": "Variants must be between 1 and 3",
  "invalidRows": ["SEQ01-001"]
}
```

### Dry Run Success (R3)
```json
{
  "batchId": "batch_1736..._<hash>",
  "runMode": "dry_run",
  "estimatedCost": 0.008,
  "message": "Dry run completed - no images generated",
  "items": [
    {
      "scene_id": "SEQ01-001",
      "variants": 2,
      "estimatedCost": 0.004
    },
    {
      "scene_id": "SEQ01-002",
      "variants": 2,
      "estimatedCost": 0.004
    }
  ]
}
```

### Live Success (R4)
```json
{
  "batchId": "batch_1736..._<hash>",
  "runMode": "live",
  "estimatedCost": 0.008,
  "accepted": 2,
  "rejected": [],
  "jobs": [
    {
      "jobId": "batch_1736..._SEQ01-001_0",
      "sceneId": "SEQ01-001",
      "status": "queued"
    },
    {
      "jobId": "batch_1736..._SEQ01-002_1",
      "sceneId": "SEQ01-002",
      "status": "queued"
    }
  ]
}
```

### Idempotency Response (R8)
```json
{
  "batchId": "batch_1736..._<hash>",
  "runMode": "live",
  "estimatedCost": 0.008,
  "message": "Job already exists (idempotent request)",
  "cached": true
}
```

### Rate Limit Error (R9)
```json
{
  "error": "RATE_LIMITED",
  "message": "Please wait 9 minutes"
}
```

## C. GCS Verification Commands

```bash
# After worker processes jobs (wait 30-60s)
gsutil ls "gs://$GCS_BUCKET/images/**"

# Check specific objects
gsutil ls "gs://$GCS_BUCKET/images/SEQ01-001/"
# Expected output:
# gs://.../images/SEQ01-001/<jobId>/var_1.png
# gs://.../images/SEQ01-001/<jobId>/var_2.png
# gs://.../images/SEQ01-001/<jobId>/thumb_1.png
# gs://.../images/SEQ01-001/<jobId>/thumb_2.png

# Verify object metadata
gsutil stat "gs://$GCS_BUCKET/images/SEQ01-001/*/var_1.png"
# Expected:
# Content-Type: image/png
# Content-Length: >20000 (must be >20KB)
# Cache-Control: public, max-age=7776000

# Download and verify thumbnail
gsutil cp "gs://$GCS_BUCKET/images/SEQ01-001/*/thumb_1.png" /tmp/thumb.png
file /tmp/thumb.png
# Expected: PNG image data, 128 x 128

# Verify signed URL works
curl -I "<signed_url_from_response>"
# Expected: HTTP 200 with Content-Type: image/png
```

## D. Log Filters (Local Testing)

For local testing, check server logs directly:

```bash
# Terminal 1 - API logs
pnpm dev 2>&1 | grep -E "Published jobs to Pub/Sub|Rate limit"

# Terminal 2 - Worker logs  
pnpm worker 2>&1 | grep -E "Processing image job|Sheet updated"
```

For Cloud Run:
```bash
# Pub/Sub publish events
gcloud logging read "resource.type=cloud_run_revision AND \
  jsonPayload.msg='Published jobs to Pub/Sub' AND \
  jsonPayload.batchId=~'batch_'" \
  --project=$PROJECT_ID --limit=10 --format=json | jq '.[].jsonPayload'

# Worker processing
gcloud logging read "resource.type=cloud_run_revision AND \
  jsonPayload.msg='Processing image job'" \
  --project=$PROJECT_ID --limit=10 --format=json | jq '.[].jsonPayload'

# Sheet updates
gcloud logging read "resource.type=cloud_run_revision AND \
  jsonPayload.msg='Sheet updated successfully'" \
  --project=$PROJECT_ID --limit=10 --format=json | jq '.[].jsonPayload'
```

## E. Pass/Fail Table

| Requirement | Description | Expected | Actual | Pass/Fail |
|------------|-------------|----------|---------|-----------|
| **R1** | Health check | ❌ Returns `{"status":"healthy"}` not `{"ok":true}` | | ⬜ |
| **R2** | Schema guard | variants=4 returns 400 error | | ⬜ |
| **R3** | Dry-run | 2 items accepted, no external calls | | ⬜ |
| **R4** | Live enqueue | Returns batchId, publishes to Pub/Sub | | ⬜ |
| **R5** | Worker runs | Sheet status updates (needs Sheet ID) | | ⬜ |
| **R6** | Real bytes | PNG >20KB in GCS, 128px thumb | | ⬜ |
| **R7** | Signed URLs | 7-day URLs returned, displayable | | ⬜ |
| **R8** | Idempotency | Duplicate POST handled correctly | | ⬜ |
| **R9** | Rate limits | 2nd batch <10min rejected | | ⬜ |
| **R10** | No video params | Gemini request clean | | ⬜ |
| **R11** | Batch writes | Single batchUpdate call | | ⬜ |
| **R12** | Error path | 429 triggers backoff | | ⬜ |

## F. Failure Fixes

### Fix R1: Health endpoint format
```diff
# /apps/orchestrator/src/routes/health.ts:8-13
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
-     status: 'healthy',
-     timestamp: new Date().toISOString(),
-     service: 'ai-asset-orchestrator',
-     version: '1.0.0',
+     ok: true
    });
  });
```

### Fix Route Path (if needed)
```diff
# /apps/orchestrator/src/server.ts
- app.register(imagesRoutes);
+ app.register(imagesRoutes, { prefix: '/batch' });
```

### Fix Missing Idempotency Return
```diff
# /apps/orchestrator/src/routes/images.ts:71
  if (exists) {
    return reply.status(200).send({
      batchId,
      runMode,
      estimatedCost,
      message: 'Job already exists (idempotent request)',
+     cached: true,
    });
  }
```

## Guardrails Verification

✅ **Files that MUST exist**:
- `/apps/orchestrator/src/workers/image-worker.ts` ✅
- `/apps/orchestrator/src/lib/pubsub.ts` ✅
- `/apps/orchestrator/src/lib/gcs.ts` ✅
- `/apps/orchestrator/src/lib/sheets.ts` ✅
- `/apps/orchestrator/src/lib/idempotency.ts` ✅
- `/apps/orchestrator/src/lib/rate-limit.ts` ✅

✅ **Key Implementation Points**:
- Zod schema at `/packages/shared/src/schemas.ts:15` limits variants to 1-3
- SHA256 idempotency at `/apps/orchestrator/src/lib/idempotency.ts:17-30`
- 10-min cooldown at `/apps/orchestrator/src/lib/rate-limit.ts:62`
- Batch updates at `/apps/orchestrator/src/lib/sheets.ts:121-128`
- No video params in `/packages/clients/src/gemini-image-client.ts:202-211`

## Test Execution Steps

1. **Start services**:
```bash
# Terminal 1: API server
cd apps/orchestrator
pnpm dev

# Terminal 2: Worker
cd apps/orchestrator
pnpm worker
```

2. **Execute tests** in order R1-R12

3. **Check GCS** after 30-60s for real images

4. **Verify logs** for Pub/Sub and Sheet updates

5. **Mark pass/fail** in table

## 🚨 Red Flags

**Mock Indicators**:
- Response contains "mock-bucket"
- Images generate instantly (<2s)
- No real `X-Goog-Signature` in URLs
- Console logs with "MOCK" or "TODO"

**Missing Integration**:
- No "Published jobs to Pub/Sub" logs
- No "Processing image job" logs
- No actual PNG files in GCS
- Sheet not updating (if connected)