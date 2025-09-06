# Build Batch Image/Video Generation UI - MVP Today

## Context

I have a working backend API deployed at `https://orchestrator-582559442661.us-central1.run.app` that handles AI image and video generation. The backend is production-ready with excellent security (97% test coverage) and supports batch operations. 

**What I need:** A single-page web app for batch processing that lets users:
1. Upload reference images
2. Enter prompts in single or batch mode
3. Preview costs (dry-run)
4. Generate images (live)
5. Approve images for video generation
6. Track status in real-time

## Current Backend Capabilities

### Endpoints Available
```
POST /batch/images
- Accepts: { items: BatchRow[], runMode: 'dry_run' | 'live' }
- Returns: { batch_job: { id, status, images: [...] } }

POST /batch/videos  
- Accepts: { items: VideoRow[], runMode: 'live', confirmCount: number }
- Returns: { batch_job: { id, status, videos: [...] } }

GET /status/:jobId
- Returns: { status, progress, results }

POST /signed-upload (needs implementation or mock)
- For GCS signed URLs for direct file upload
```

### Working Features
- Image generation with variants (1-3 per prompt)
- Cost tracking ($0.002 per image)
- Idempotency via SHA256 hashing
- Batch processing with status updates
- Thumbnail generation (128px)
- RFC 7807 error handling

## Requirements

### UI Sections (Single Page)

1. **Upload Zone (Top)**
   - Drag/drop multiple JPG/PNG files
   - Upload to GCS via signed URLs
   - Show chips with filenames after upload

2. **Prompts Section (Middle)**
   - Mode toggle: Single | Batch
   - **Single mode:** One prompt input + variants selector (1-3)
   - **Batch mode:** Textarea where each line = `scene_id | prompt | variants`
   - "Parse" button shows preview table with counts
   - Max 10 rows, max 3 variants per row

3. **Action Buttons**
   - "Dry-Run Images" → Shows cost preview ($0.002 × total_variants)
   - "Generate Images" → Disabled until dry-run completes for same batch hash
   - "Approve" → Click thumbnail to select one per scene (checkmark overlay)
   - "Generate Video" → Appears when ≥1 approved, requires typing exact count

4. **Status Log (Bottom)**
   - Append-only list: `[timestamp] job_id scene_id status message`
   - Real-time updates during processing

## Technical Specs

### Batch Format
```
SEQ01-001 | Warm kitchen, morning backlight | 3
SEQ01-002 | Wide hallway, tungsten spill | 2
```

### Idempotency Hash
```javascript
// SHA256(mode + normalizedRows + dayBucket)
const dayBucket = Math.floor(Date.now() / 86400000);
const content = mode + JSON.stringify(rows) + dayBucket;
const hash = sha256(content);
// Send as header: X-Batch-Hash
```

### Guardrails (CRITICAL)
- Client-side caps: ≤10 rows, ≤3 variants
- Server validates same limits
- Dry-run required before live (same hash)
- Manual actions only (no auto-submit)
- Cost confirmation before any paid action
- Video requires typing exact clip count

## Stack Preferences

- **Framework:** Next.js 14 (App Router) or plain React
- **Styling:** Tailwind CSS (minimal, clean)
- **State:** React Query for API, Zustand for local state
- **No auth required** - public demo
- **Mock mode:** Toggle via `NEXT_PUBLIC_USE_MOCK=true` for local dev

## Questions for Implementation

1. **File Upload Strategy:** Should we implement real GCS signed URLs or mock the upload for MVP? If mocking, should uploaded files be stored in browser memory or localStorage?

2. **Batch Parsing:** For the batch textarea, should we validate on every keystroke or only on "Parse" button click? How should we handle malformed lines - skip them or show inline errors?

3. **Status Updates:** Should we use SSE (Server-Sent Events), WebSocket, or polling for real-time status? Given it's an MVP, is 2-second polling acceptable?

4. **Approval State:** Where should we persist approval selections - localStorage, sessionStorage, or just in-memory? What happens if user refreshes mid-process?

5. **Error Recovery:** How should we handle partial batch failures (e.g., 3 succeed, 2 fail)? Show which specific rows failed and allow retry of just those?

## Concerns

1. **CORS:** Will the backend at `orchestrator-582559442661.us-central1.run.app` accept requests from localhost:3000? Need to handle CORS headers.

2. **API Key:** The backend requires `x-api-key` header. For demo, can we use: `aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc`?

3. **Hash Mismatch:** If user edits batch after dry-run, the hash changes. Should we auto-trigger new dry-run or show clear warning?

4. **Rate Limiting:** Should we debounce API calls? Add client-side rate limiting?

5. **Mobile:** Should this work on mobile or desktop-only for MVP?

## Deliverables Needed

1. **Complete working app** (single HTML or Next.js project)
2. **Batch parser** that handles `scene_id | prompt | variants` format
3. **Two-phase flow** (dry-run blocks live until complete)
4. **Approval UI** (select one thumbnail per scene)
5. **Cost display** at every step
6. **Status logging** with real-time updates

## Success Criteria

- [ ] Can paste 2-10 lines of batch text and see parsed preview
- [ ] Dry-run shows cost, blocks live until complete
- [ ] Live generation returns thumbnails (max 3 per row)
- [ ] Can approve exactly one image per scene
- [ ] Video generation requires typed count confirmation
- [ ] All errors show clear messages
- [ ] Works without any backend changes (uses existing API)

## Example Batch to Test
```
SCENE-001 | Modern kitchen with morning light | 2
SCENE-002 | Cozy living room with fireplace | 3
SCENE-003 | Home office with plants | 1
```

## Additional Notes

- Backend already handles all security/validation
- Focus on UX flow and safety guards
- Keep it minimal - this is for testing the batch concept
- Can be rough around edges but must be safe (no accidental costs)

**Please build this as a complete, working MVP that I can run locally today. Ask any clarifying questions before starting.**