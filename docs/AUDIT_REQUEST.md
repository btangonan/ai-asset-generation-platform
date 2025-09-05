# Code Audit Request: AI Asset Generation Platform

## System Overview
We're building an AI Asset Generation Platform that converts Google Sheets data into AI-generated images using Gemini 2.0 Flash API. The system is built with TypeScript, Fastify, and Google Cloud services.

## Current Problem
**The API endpoint `/batch/images` is returning schema validation errors when attempting to generate real images.**

## Architecture
- **Backend**: Fastify server on port 9090
- **Storage**: Google Cloud Storage (bucket: solid-study-467023-i3-ai-assets)
- **Queue**: Google Pub/Sub for async job processing
- **AI Model**: Gemini 2.0 Flash for image generation
- **Project ID**: solid-study-467023-i3
- **API Key**: Available in environment

## Symptoms
1. When sending POST request to `/batch/images` with valid payload, returns:
   ```json
   {
     "error": "INVALID_REQUEST_SCHEMA",
     "message": "Request does not match expected schema"
   }
   ```

2. Server logs show the request arrives but fails validation immediately

3. The schema expects:
   ```typescript
   {
     items: [{
       scene_id: string,
       prompt: string,
       ref_pack_public_urls?: string[],  // optional array of URLs
       variants: number (1-3)
     }],
     runMode: "dry_run" | "live"
   }
   ```

## Code Locations

### Schema Definition
`/packages/shared/src/schemas.ts`:
- Lines 11-16: ImageBatchItemSchema definition
- Line 14: `ref_pack_public_urls` defined as optional array

### Route Handler
`/apps/orchestrator/src/routes/images.ts`:
- Lines 15-24: Schema validation logic
- Line 18: Uses `ImageBatchRequestSchema.parse()`
- Line 106: References `item.ref_pack_public_urls`

### Current Environment
- Server running in LIVE mode with real credentials
- All environment variables properly set
- TypeScript compilation has some errors but tsx watch is running

## Failed Test Cases

### Test 1: Simple dry run
```bash
curl -X POST "http://localhost:9090/batch/images" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "scene_id": "TEST-001",
      "prompt": "A modern kitchen",
      "variants": 1
    }],
    "runMode": "dry_run"
  }'
```
**Result**: Schema validation error

### Test 2: Live mode with full payload
```bash
curl -X POST "http://localhost:9090/batch/images" \
  -H "Content-Type: application/json" \
  -H "X-Sheet-Id: test-sheet-123" \
  -d '{
    "items": [{
      "scene_id": "DEMO-001",
      "prompt": "A cozy modern kitchen with warm morning sunlight",
      "variants": 2
    }],
    "runMode": "live"
  }'
```
**Result**: Schema validation error

## Specific Questions for Audit

1. **Schema Import Issue**: Is there a mismatch between the schema definition in `/packages/shared` and what's being imported in the routes file?

2. **Zod Parsing**: The error happens at `ImageBatchRequestSchema.parse()` - is Zod properly configured and are all dependencies resolved?

3. **Module Resolution**: The project uses a monorepo with pnpm workspaces. Are the `@ai-platform/shared` imports resolving correctly?

4. **Runtime vs Compile Time**: TypeScript compilation shows errors but tsx watch mode runs. Could this cause schema validation issues?

5. **Field Name Consistency**: Is there any place where `ref_pack_public_url` (singular) is still used instead of `ref_pack_public_urls` (plural)?

## Previous Fixes Attempted
1. Changed from `z.enum([720, 1080])` to `z.union([z.literal(720), z.literal(1080)])` for ResolutionSchema
2. Updated field from `ref_pack_public_url` to `ref_pack_public_urls` 
3. Fixed imports to use `@ai-platform/shared` instead of `@vertex-system/shared`
4. Restarted server multiple times with fresh builds

## Expected Outcome
The endpoint should:
1. Accept the JSON payload
2. Validate it against the schema
3. In dry_run mode: Return cost estimate without making API calls
4. In live mode: 
   - Generate a batch ID
   - Publish jobs to Pub/Sub
   - Return accepted jobs with status "queued"
   - Actually generate images via Gemini API

## Request for Auditor
Please review the schema validation flow and identify why valid JSON payloads are being rejected. The core issue appears to be in the Zod schema parsing at the very beginning of the request handler. We need to determine if this is a:
- Schema definition problem
- Import/module resolution issue  
- Runtime type checking problem
- Dependency version mismatch

The goal is to successfully generate real images using the Gemini 2.0 Flash API.