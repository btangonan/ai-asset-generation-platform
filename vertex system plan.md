Kick off instructions

**AI Asset Generation Platform – Product Plan (Self-Critiqued)**

## **1\. North Star**

Enable creative teams to ideate (Nano Banana stills) and execute (Veo 3 video) with:

* Human control (no auto-spend).

* Familiar UX (Google Sheets front-end).

* Reliable infra (Cloud Run, Pub/Sub, GCS).

* Guardrails: spec locks, budget visibility, and logging.

---

## **2\. Core User Flows**

### **A. Variation Testing (20 scenarios)**

* 20 rows in the Sheet, each with different **ref\_pack\_id**.

* Producer selects all → “Generate Images.”

* Thumbnails return, creatives approve winners.

* Producer queues only approved rows → Veo 3\.

* Get MP4 links back, cut into editorial.

### **B. Sequential Testing (storyboard of 10 shots)**

* 10 rows, `scene_id` 001–010. Each row linked to a `ref_pack_id`.

* Generate stills, review, approve.

* Queue approved stills for Veo 3\.

* Output videos delivered in order for animatic assembly.

---

## **3\. Tech Stack**

### **Front-End UX**

* **Google Sheets** as the control surface.

* **Custom menu** via Apps Script (UI only):

  * `Generate Images (Dry-Run)`

  * `Generate Images (Live)`

  * `Generate Video (Veo)`

* Optional **sidebar** for thumbnails and controls.

### **Back-End**

* **Cloud Run service**:

  * `/batch/images` → Nano Banana image runs.

  * `/batch/videos` → Veo 3 video runs.

  * `/status/:job_id` → return logs.

* **Pub/Sub**: queue per row, decouples producer clicks from long jobs.

* **Cloud Storage (GCS)**: canonical store for all generated assets.

* **Firestore (optional)**: job ledger; avoids Sheets as single source of truth.

### **Models**

* **Nano Banana (Gemini 2.5 Flash Image)**:

  * Input: `prompt`, `ref_pack_public_url` images.

  * Output: 3 PNGs (720×720 default).

  * Constraints: **No fps, duration, resolution params**. Aspect guided by refs/prompts.

* **Veo 3 / Veo 3 Fast** on Vertex AI:

  * Input: `prompt`, `approved_image_url`, `aspect (16:9|9:16)`, `resolution (720|1080)`.

  * Constraints: **fps=24**, **duration=8s** only.

  * Output: up to 4 clips (Veo 3 Fast) or 2 (Veo 3 Preview).

---

## **4\. Sheet Schema**

| Column | Purpose |
| ----- | ----- |
| `scene_id` | Unique ID, sequential or variation key |
| `mode` | `variation` | `sequence` |
| `prompt` | Text description |
| `ref_pack_id` | ID of reference pack |
| `ref_pack_url` | Human-facing Drive folder link |
| `ref_pack_public_url` | GCS signed URL for API use |
| `style_kit_id` | Optional style overlay |
| `status_img` | \`queued |
| `nano_img_1..3` | Thumbnail links to outputs |
| `approved_image_url` | Producer-selected still |
| `veo_model` | `veo3` or `veo3_fast` |
| `aspect` | `16:9` | `9:16` |
| `resolution` | `720` | `1080` |
| `duration_s` | Locked to 8 |
| `fps` | Locked to 24 |
| `est_cost_video` | Formula-based estimate |
| `status_video` | \`ready\_to\_queue |
| `video_url` | Output MP4 link |
| `job_id` | Unique for traceability |
| `locked_by` | User who queued job |

---

## **5\. Error Handling**

**Nano Banana (Images)**

* **Caps:** max 10 rows per run, 3 variants per row.

* **Rate limit:** 1 run per user per 10 min.

* **Server checks:** reject if status ≠ `queued`.

* **Duplicate prevention:** hash(prompt+ref\_pack\_id).

**Veo 3 (Video)**

* **Strict validation:** reject if `duration_s≠8`, `fps≠24`, `aspect` not in {16:9,9:16}, or resolution not in {720,1080}.

* **Cost confirmation:** require typed confirmation of clip count before queueing.

* **Server-side locking:** set `status=queued`, `locked_by=user` immediately.

* **Retry/backoff:** exponential on 429s. Fail → `status=error` with reason.

**Shared**

* **Idempotency keys:** `job_id = hash(scene_id+approved_image_url+model+timestamp)`.

* **Writeback safety:** if Sheets API fails, log job in Firestore; provide “Reconcile Sheet” menu action.

* **Alerting:** Slack/email on \>5 errors in 10 min or budget breach.

---

## **6\. Governance and Cost Controls**

* **Dry-Run mode:** default in Sheets. Shows counts/est. cost, no API calls.

* **Est. cost formulas:** rates tab in Sheet.

* **Spend limits:** daily caps per user; global toggle `RUN_MODE=dry_run` if budget hit.

* **Audit:** log job params, requester email, cost est. in Firestore.

* **Data lifecycle:** GCS lifecycle rule auto-deletes variants \>90 days. Canonical “gold” refs persist.

---

## **7\. Producer UX Checklist**

1. Drop refs into Drive folder → sync job creates `ref_pack_id` \+ mosaic.

2. In Sheet, select rows → **AI → Generate Images**. Confirm count in Dry-Run, rerun Live.

3. Review thumbs → set `approved_image_url`.

4. Change `status_video=ready_to_queue`.

5. Select rows → **AI → Generate Video (Veo)**. Confirm est. cost.

6. Wait for `video_url` → pass to edit team.

---

## **8\. Audit Flaws & Fixes**

* **Flaw:** Relying only on Sheets means no durable state.  
   **Fix:** Mirror state in Firestore; Sheet is a UI, not system of record.

* **Flaw:** Apps Script quotas (6 min, 20k UrlFetch/day).  
   **Fix:** Keep Apps Script minimal (UI only). Real work in Cloud Run.

* **Flaw:** Producers could bypass menus and edit cells.  
   **Fix:** Server re-validates all parameters. No trust in Sheets data.

* **Flaw:** Ref links break if Drive folders are moved.  
   **Fix:** Sync job mirrors all Drive files to GCS; models use GCS signed URLs.

* **Flaw:** Quota exhaustion (Sheets or Vertex).  
   **Fix:** Batch `values.batchUpdate` to Sheets; respect Veo per-minute caps; backoff on 429s.

* **Flaw:** Outputs drift in storage.  
   **Fix:** Store all outputs in GCS with object versioning, 30-day retention on variants.

* **Flaw:** No clear cost visibility.  
   **Fix:** Est. cost per row, SUM at header, daily Slack digest of spend vs budget.

---

## **9\. Validation for Code Auditor**

* **Spec compliance:**

  * Veo 3/3 Fast: aspect (16:9, 9:16), res (720,1080), fps=24, duration=8.

  * Gemini Image: prompt+refs only; no fps/duration/res.

* **API call schemas:** enforce with Zod or Joi.

* **Logging:** one structured log per job, redact PII.

* **IAM:**

  * Service account with Vertex AI \+ Storage \+ Pub/Sub \+ Sheets.

  * No wide-scope API keys.

* **Security:** all GCS URLs signed, short expiry (7 days default).

* **Testing:** unit tests for client wrappers, e2e test with dummy Sheet → image → approved → video.

---

## **10\. Deliverables**

* **Codebase:** TypeScript monorepo (apps/orchestrator, packages/clients, packages/sheets, packages/shared).

* **Infra:** Dockerfile, Cloud Build config, Terraform for GCS/Firestore/PubSub.

* **Docs:**

  * README for local dev & deploy.

  * Runbook for producers.

  * Guardrails doc for auditors.

* **Dashboards:** Looker/BigQuery for jobs per day, error rate, spend.

* **QC Checklist:**

  * Can’t queue unsupported params.

  * Cost must be visible and confirmed.

  * GCS URLs load.

  * Duplicate requests rejected.

  * Errors show human-readable reason in Sheet.

# **Claude Code — Build the “Sheets → GCS → Nano Banana → Veo 3” Platform**

You are generating a **production-ready TypeScript** system that lets producers run **manual-only** image and video generations from **Google Sheets**, using **Gemini 2.5 Flash Image** for stills (“Nano Banana”) and **Veo 3 / Veo 3 Fast** on **Vertex AI** for short video. All assets store in **GCS**. The UI in Sheets is a **custom menu**. Keep Apps Script as a thin UI that calls our backend. Do not auto-spend credits. Every video run must be manually initiated with a visible cost estimate.

## **Outcomes**

* Producers click a **menu** in Google Sheets to batch-generate **stills** for selected rows, then **approve** one still per row, then click a menu to **queue Veo video** for only the approved rows.

* The backend enforces **strict model specs** and **hard guardrails**.

* Assets save to **GCS**. Sheet gets only **thumb links** and final **video URLs**.

---

## **Architecture**

Monorepo with **pnpm workspaces**:

`.`  
`├─ apps/`  
`│  └─ orchestrator/            # Cloud Run service (Fastify)`  
`│     ├─ src/`  
`│     │  ├─ index.ts           # bootstrap + routes`  
`│     │  ├─ routes/images.ts   # POST /batch/images (manual, guarded)`  
`│     │  ├─ routes/videos.ts   # POST /batch/videos (manual, guarded)`  
`│     │  ├─ routes/status.ts   # GET  /status/:jobId`  
`│     │  ├─ workers/consume.ts # Pub/Sub consumer`  
`│     │  └─ lib/{gcs.ts,pubsub.ts,logger.ts,auth.ts,cost.ts}`  
`│     ├─ package.json`  
`│     ├─ tsconfig.json`  
`│     └─ Dockerfile`  
`├─ packages/`  
`│  ├─ sheets/                  # Google Sheets helper`  
`│  │  └─ src/sheetsClient.ts`  
`│  ├─ clients/`  
`│  │  ├─ src/vertexVeoClient.ts     # Veo 3 + Veo 3 Fast on Vertex AI`  
`│  │  └─ src/geminiImageClient.ts   # Gemini 2.5 Flash Image (Nano Banana)`  
`│  └─ shared/`  
`│     └─ src/{types.ts,schema.ts,errors.ts,env.ts,rate.ts}`  
`├─ tools/`  
`│  └─ apps_script/             # UI-only custom menu + optional sidebar`  
`│     └─ Code.gs`  
`├─ infra/`  
`│  ├─ cloudbuild.yaml`  
`│  ├─ terraform/               # optional: GCS, Pub/Sub, SA, IAM`  
`│  └─ workflows.yaml           # optional orchestration`  
`├─ .env.example`  
`└─ pnpm-workspace.yaml`

**Runtime**: Node 20, TypeScript, Fastify.  
 **Cloud**: Cloud Run (service \+ Jobs for backfills), Pub/Sub, GCS, optional Firestore for durable job ledger.  
 **Why Cloud Run**: serverless containers, scale-to-zero, IAM, Pub/Sub integration, Vertex access.  
 **Why GCS**: signed URLs, lifecycle rules, stable direct reads for model APIs.  
 **Sheets**: UI only. State of record lives in Firestore or Postgres; write shallow status back to Sheets.

---

## **Model specs you must hard-enforce**

**Veo 3 preview** (`veo-3.0-generate-preview`) and **Veo 3 Fast** (`veo-3.0-fast-generate-001`) on Vertex AI:

* Aspect: `16:9` or `9:16` only.

* Resolution: `720` or `1080` only.

* FPS: `24` only.

* Length: `8` seconds per clip.

* Max videos per request: **2** for Veo 3 preview. **4** for Veo 3 Fast.

* RPM cap example: docs note **10 requests per minute per project**.  
   Reject any other values server-side. [Google Cloud+1](https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-generate-preview?utm_source=chatgpt.com)

**Nano Banana** \= **Gemini 2.5 Flash Image** via Gemini API:

* Prompt \+ image conditioning.

* No fps or duration. No hard video-style aspect param.

* Use Files API or direct GCS signed URLs as refs.  
   Do not send unsupported knobs. [Google AI for Developers+1](https://ai.google.dev/gemini-api/docs/image-generation?utm_source=chatgpt.com)

**SynthID** watermarking for Google image/video models is a governance talking point. Include optional verification helpers for images. [Google Cloud+1](https://cloud.google.com/vertex-ai/generative-ai/docs/image/quickstart-image-generate-console?utm_source=chatgpt.com)[Google DeepMind](https://deepmind.google/science/synthid/?utm_source=chatgpt.com)

---

## **Google Sheet schema**

One row \= one scene.

Columns:

* `scene_id` string

* `mode` enum `variation|sequence`

* `prompt` string

* `ref_pack_id` string

* `ref_pack_url` Drive link (human)

* `ref_pack_public_url` GCS signed URL (machine)

* `style_kit_id` optional

* `status_img` enum `queued|running|awaiting_review`

* `nano_img_1..3` thumbnail URLs

* `approved_image_url` string

* `veo_model` enum `veo3|veo3_fast`

* `aspect` enum `16:9|9:16`

* `resolution` enum `720|1080`

* `duration_s` fixed 8 (read-only)

* `fps` fixed 24 (read-only)

* `est_cost_video` number

* `status_video` enum `ready_to_queue|queued|running|done|error`

* `video_url` string

* `job_id` string

* `locked_by` string (email)

Reference tabs:

`REF_PACKS`:

* `ref_pack_id`, Drive path, GCS path, mosaic\_thumb\_url, owner

`STYLE_KITS`:

* `style_kit_id`, name, 3–6 canonical images, notes

---

## **State machines**

**Images**  
 `queued → running → awaiting_review`

**Videos**  
 `ready_to_queue → queued → running → done|error`

Server rejects transitions out of order.

---

## **Security, IAM, and secrets**

* Service account with: Vertex AI User, Storage Object Admin (bucket-scoped), Pub/Sub Pub/Sub, Sheets API, optional Firestore.

* No broad API keys in code. Use ADC on Cloud Run.

* Signed URLs for GCS assets. Default 7-day expiry.

* Optional: restrict `/batch/*` to IAP or OAuth group.

---

## **Guardrails to implement**

**Manual-only. No auto-spend.**

* Apps Script only posts rows to backend after a **count and cost** dialog.

* Backend **re-validates** params and model specs.

* Daily and per-user batch caps.

* Global `RUN_MODE = dry_run|live`. Dry run by default.

**Caps**

* Images: max 10 rows per click. Max 3 variants per row.

* Videos: enforce per-request max outputs by model. Split batches.

**Idempotency**  
 `job_id = sha256(scene_id + model + (approved_image_url or ref_pack_id) + day_bucket)`  
 Reject duplicate jobs for 24h.

**Rate limiting**

* Per-user: at most one image batch per 10 minutes.

* Project: respect RPM limits (ex. Veo 10 RPM). Queue with Pub/Sub.

**Cost estimator**  
 `est_cost_video = rate(model,resolution) * (duration_s/8)`  
 Sheet shows per-row and sum. Backend includes estimate in confirm dialog.

**Write-back resilience**  
 If Sheets write fails, store job state in Firestore; expose “Reconcile Sheet” action.

---

## **APIs and data contracts**

Use **Zod** for runtime validation. Return **problem+json** on 4xx/5xx.

### **POST `/batch/images`**

Body:

`{`  
  `"items": [{`  
    `"scene_id": "SEQ01-001",`  
    `"prompt": "Warm cinematic kitchen. Morning backlight.",`  
    `"ref_pack_id": "RP-abc123",`  
    `"ref_pack_public_url": "https://storage.googleapis.com/...signed",`  
    `"variants": 3`  
  `}],`  
  `"runMode": "live"  // or "dry_run"`  
`}`

Rules:

* Only accept rows with `status_img=queued`.

* Enforce caps and per-user limits.

* On live: enqueue N Pub/Sub messages (1 per row).

* Respond: `{ batchId, accepted, rejected[] }`.

### **POST `/batch/videos`**

Body:

`{`  
  `"items": [{`  
    `"scene_id": "SEQ01-001",`  
    `"prompt": "Same tone as approved still.",`  
    `"approved_image_url": "https://storage.googleapis.com/...signed",`  
    `"veo_model": "veo3_fast",`  
    `"aspect": "16:9",`  
    `"resolution": 1080`  
  `}],`  
  `"runMode": "live",`  
  `"confirmCount": 4`  
`}`

Rules:

* Must have `status_video=ready_to_queue` and `approved_image_url`.

* Validate exact Veo specs. Split into requests that respect per-request output limits.

* On accept: set `status_video=queued`, set `locked_by`, enqueue.

### **GET `/status/:jobId`**

* Returns job envelope, current state, last error if any, output URIs.

---

## **Packages to implement**

### **`packages/shared/src/schema.ts`**

* Zod schemas: `ImageBatchItem`, `VideoBatchItem`, `RunMode`, `Aspect`, `Resolution`, `VeoModel`, `Status`.

* Narrow literal unions for model specs.

### **`packages/clients/src/geminiImageClient.ts`**

* `generateImages(params: { prompt: string; refPackUrls: string[]; variants: 1|2|3 }): Promise<{gcsUris: string[], thumbs: string[]}>`

* Use Gemini API image generation. Upload refs via Files API or pass public signed URLs. Write outputs to `gs://…/images/{scene_id}/{job_id}/var_#.png`. Return signed URLs.  
   No fps/duration. No resolution params. Crop/resize after save if needed. [Google AI for Developers+1](https://ai.google.dev/gemini-api/docs/image-generation?utm_source=chatgpt.com)

### **`packages/clients/src/vertexVeoClient.ts`**

* `generateVideo(params: { prompt: string; seedImageUrl: string; model: 'veo-3.0-generate-preview'|'veo-3.0-fast-generate-001'; aspect: '16:9'|'9:16'; resolution: 720|1080 }): Promise<{gcsUri: string}>`

* Call Vertex AI Veo with strict params. Enforce 8s and 24 fps in code. Save MP4 to `gs://…/videos/{scene_id}/{job_id}/clip_#.mp4`. Return signed URL. [Google Cloud+1](https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-generate-preview?utm_source=chatgpt.com)

### **`packages/sheets/src/sheetsClient.ts`**

* `getRows(range: string): Promise<Row[]>`

* `updateRow(sceneId: string, patch: Partial<Row>): Promise<void>`

* Always batch updates with `values.batchUpdate` to reduce quota hits. Handle 429 with backoff. [Google for Developers](https://developers.google.com/apps-script/guides/services/quotas?utm_source=chatgpt.com)

---

## **Apps Script UI (UI-only)**

`tools/apps_script/Code.gs`

* `onOpen()` creates **AI** menu:

  * Generate Images (Dry-Run)

  * Generate Images (Live)

  * Generate Video (Veo)

* `generateImages(mode)` collects selected rows, validates basics client-side, shows count dialog, posts to `/batch/images`.

* `generateVideo(mode)` does same for videos, shows **est. cost** sum and requires typing the exact count to confirm.

* Do not loop network calls. One POST per click. Keep under 6-minute Apps Script quotas. [Google for Developers](https://developers.google.com/apps-script/guides/services/quotas?utm_source=chatgpt.com)

Provide minimal, working Apps Script (no business logic).

---

## **Pub/Sub worker**

* One message per row.

* Worker validates schema again.

* For images: calls `geminiImageClient.generateImages`, writes `nano_img_1..3` thumbnails and `status_img=awaiting_review` back to Sheet.

* For videos: calls `vertexVeoClient.generateVideo`, writes `video_url` and `status_video=done`.

* On failures: write `status_* = error` with short reason, keep detailed error in logs.

---

## **Storage layout in GCS**

`gs://{project}-ai-renders/`  
  `images/{campaign}/{scene_id}/{job_id}/var_1.png`  
  `videos/{campaign}/{scene_id}/{job_id}/clip_1.mp4`  
  `ref_packs/{campaign}/{ref_pack_id}/...`

* Turn on **lifecycle rules**: 90-day delete for variants, keep “gold” refs.

* Generate signed URLs for Sheet. Keep canonical `gs://` path in state.

---

## **Logging and observability**

* Pino logger with requestId, jobId, sceneId, user email, model, estCost.

* Export to Cloud Logging.

* Optional BigQuery sink. Build a Looker dashboard: runs/day, errors by reason, spend vs budget.

---

## **Rate limits and retries**

* Truncated exponential backoff on 429/5xx for Sheets, Gemini, Vertex.

* Per-user cooldown: store last image batch timestamp in Firestore.

* Global RPM pacing for Veo.

---

## **Testing**

* Unit tests: schema validation, clients, cost calc.

* E2E smoke: mock Sheet with 3 rows → images → approve one → video → assert URLs written back.

* Load test for 50 rows dry-run to ensure the UI and backend path do not trip quotas.

---

## **CI/CD**

* `cloudbuild.yaml` builds and deploys `apps/orchestrator` to Cloud Run with min instances 1 and concurrency 20\.

* Secrets from Secret Manager.

* Post-deploy smoke test hits `/healthz`.

---

## **Terraform (optional)**

* GCS bucket with lifecycle rules and CORS.

* Pub/Sub topic \+ subscription.

* Service account \+ roles.

* Optional Firestore native mode.

---

## **Acceptance criteria**

* Apps Script menu appears in Sheet.

* Dry-run shows counts and est. cost. Live requires typed confirmation.

* Image batch returns up to 3 thumbs per row and sets `status_img=awaiting_review`.

* Video batch requires `approved_image_url`, writes `video_url`, and sets `status_video=done`.

* Any unsupported Veo param is rejected with a clear error.

* Idempotency prevents duplicate spend.

* Logs include requester, scene, model, and cost estimate.

---

## **Known risks and mitigations**

* Sheets selection under filters can be misleading. Re-fetch by `scene_id` on backend.

* Drive link churn. Mirror ref packs to GCS and use signed URLs for models.

* Apps Script quotas. Keep UI thin. Single POST per action. [Google for Developers](https://developers.google.com/apps-script/guides/services/quotas?utm_source=chatgpt.com)

---

## **Seed data and examples**

Provide:

* A sample Sheet CSV with 6 rows, two `variation` and four `sequence`.

* Two sample ref packs with 3–5 images each and a tiny `notes.md`.

* Example prompts.

* A Postman collection for `/batch/images`, `/batch/videos`, `/status/:jobId`.

---

## **Implementation notes**

* Use `@google-cloud/storage`, `@google-cloud/pubsub`, `@google-cloud/firestore` (optional), `@fastify/*`, `zod`, `pino`.

* For Gemini: use the **Gemini API** client. Handle Files API for uploads when needed. [Google AI for Developers+1](https://ai.google.dev/gemini-api/docs/files?utm_source=chatgpt.com)

* For Veo: use **Vertex AI** REST or official SDK with ADC. Enforce the exact constraints listed above. [Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation?utm_source=chatgpt.com)

---

## **Specs references**

* Veo 3 preview model capabilities, limits, aspect, resolution, fps, length, outputs per request. [Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-generate-preview?utm_source=chatgpt.com)

* Veo 3 Fast capabilities and limits. [Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-fast-generate-001?utm_source=chatgpt.com)

* Veo API reference on Vertex AI. [Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation?utm_source=chatgpt.com)

* Gemini image generation overview and model availability. [Google AI for Developers+1](https://ai.google.dev/gemini-api/docs/image-generation?utm_source=chatgpt.com)

* Gemini Files API for media upload. [Google AI for Developers](https://ai.google.dev/gemini-api/docs/files?utm_source=chatgpt.com)

* Apps Script quotas. Keep UI thin. [Google for Developers](https://developers.google.com/apps-script/guides/services/quotas?utm_source=chatgpt.com)

* SynthID watermark verification for images. [Google Cloud+1](https://cloud.google.com/vertex-ai/generative-ai/docs/image/quickstart-image-generate-console?utm_source=chatgpt.com)

# **Project Structure Best Practices (Tailored)**

## **Monorepo layout**

`your-project/`  
`├─ apps/`  
`│  └─ orchestrator/                # Cloud Run service (Fastify, Node 20, TS)`  
`│     ├─ src/`  
`│     │  ├─ index.ts               # bootstrap + routes + healthz`  
`│     │  ├─ routes/`  
`│     │  │  ├─ images.ts           # POST /batch/images (manual, guarded)`  
`│     │  │  ├─ videos.ts           # POST /batch/videos (manual, guarded)`  
`│     │  │  └─ status.ts           # GET  /status/:jobId`  
`│     │  ├─ workers/consume.ts     # Pub/Sub consumer`  
`│     │  └─ lib/{gcs.ts,pubsub.ts,logger.ts,auth.ts,cost.ts}`  
`│     ├─ package.json`  
`│     ├─ tsconfig.json`  
`│     └─ Dockerfile`  
`├─ packages/`  
`│  ├─ clients/`  
`│  │  ├─ src/vertexVeoClient.ts    # Veo 3 / Veo 3 Fast (Vertex AI)`  
`│  │  └─ src/geminiImageClient.ts  # Nano Banana (Gemini 2.5 Flash Image)`  
`│  ├─ sheets/`  
`│  │  └─ src/sheetsClient.ts       # Google Sheets v4 helper`  
`│  └─ shared/`  
`│     └─ src/{types.ts,schema.ts,errors.ts,env.ts,rate.ts}`  
`├─ tools/`  
`│  └─ apps_script/                 # UI-only custom menu for Sheets`  
`│     └─ Code.gs`  
`├─ infra/`  
`│  ├─ cloudbuild.yaml`  
`│  ├─ workflows.yaml               # optional: GCP Workflows orchestration`  
`│  └─ terraform/                   # optional: GCS, Pub/Sub, SA, IAM, Firestore`  
`├─ tests/`  
`│  ├─ unit/                        # zod schema, clients, cost calc`  
`│  └─ e2e/                         # sheet→images→approve→video happy-path`  
`├─ docs/`  
`│  ├─ RUNBOOK.md                   # producer runbook (UX steps)`  
`│  ├─ GUARDRAILS.md                # model specs & spend controls`  
`│  └─ QC_CHECKLIST.md              # pass/fail table for QA`  
`├─ scripts/`  
`│  ├─ dev-seed.ts                  # seed sample rows & ref packs`  
`│  └─ reconcile-to-sheet.ts        # writeback recovery job`  
`├─ .env.example`  
`├─ pnpm-workspace.yaml`  
`└─ package.json`

## **Essential .md files**

* **README.md** — quick start, local dev, deploy, service account & Sheet sharing.

* **CLAUDE.md** — how Claude should work here (patterns, constraints, don’ts).

* **GUARDRAILS.md** — hard model limits (Veo: 16:9/9:16, 720/1080, 8s, 24fps; Gemini Image: no fps/duration), manual-only spending, rate limits, idempotency.

* **RUNBOOK.md** — producer steps with screenshots.

* **QC\_CHECKLIST.md** — test steps, expected outcomes, pass/fail.

## **CLAUDE.md template (fill these in)**

`# Project Name: Sheets → GCS → Nano Banana → Veo 3`

`## Quick Start`  
`- Install: pnpm i && pnpm -w build`  
`- Run local API: pnpm -w dev (PORT=9090)`  
`- Test: pnpm -w test`  
`- Deploy: gcloud builds submit; gcloud run deploy ...`

`## Architecture`  
`- Backend: Fastify on Cloud Run, Pub/Sub worker, optional Workflows`  
`- Storage: GCS (signed URLs), lifecycle rules`  
`- State: Firestore (jobs), Sheets for producer UI`  
`- Models: Gemini 2.5 Flash Image, Veo 3 / Veo 3 Fast (Vertex)`

`## Development Notes`  
`- Apps Script is UI-only. Never put business logic there.`  
`- Enforce model specs via zod at API boundary.`  
`- Idempotency: job_id = sha256(scene_id + model + seed + day_bucket)`  
`- Re-validate everything server-side. Never trust cell edits.`  
`- Batch Sheets writes; exponential backoff on 429.`

`## Testing`  
`- Unit: zod schemas, clients, cost calculator`  
`- E2E: mock sheet → image gen → approve → video gen → URLs written back`

## **Development workflow patterns**

* Branch naming: `feat/…`, `fix/…`, `chore/…`.

* Never push to main. PRs require passing tests \+ lint \+ typecheck.

* Keep dependencies minimal; prefer first-party Google SDKs.

* Organize by feature/domain; co-locate route \+ schema \+ client where sensible.

## **Quality gates (scripts in package.json)**

* `pnpm lint` `pnpm typecheck` `pnpm test` must pass before merge.

* No TODOs in core paths.

* All external requests wrapped with retries and timeouts.

## **Initialization checklist**

1. **Repo:** `git init`, `.gitignore`, `feat/init-scaffold` branch.

2. **Core files:** README, CLAUDE.md, .env.example, pnpm workspace.

3. **CI/CD:** Cloud Build or GitHub Actions; smoke test `/healthz`.

4. **Infra:** GCS bucket \+ lifecycle, Pub/Sub topic, service account, IAM bindings.

5. **Docs:** Fill RUNBOOK, GUARDRAILS, QC\_CHECKLIST.

## **Key principles**

* **Start simple.** Ship manual-only path first.

* **Spec fidelity.** Reject any unsupported Veo/Gemini params.

* **Traceability.** Log requester, scene\_id, model, est cost, outputs.

* **Spend safety.** Dry-run default; typed confirmation for video.

---

# **Acceptance Criteria (enforce in code & tests)**

* Apps Script menu shows 3 items; each sends exactly one POST.

* `/batch/images` rejects if `status_img≠queued`, caps ≤10 rows, ≤3 variants.

* `/batch/videos` rejects unless `approved_image_url` present and `status_video=ready_to_queue`.

* Veo requests strictly: aspect ∈ {16:9,9:16}, res ∈ {720,1080}, fps=24, duration=8; split outputs per request within model limits.

* Idempotency prevents duplicates within 24h window.

* Sheets writes are batched; exponential backoff on 429/5xx.

* GCS outputs land under deterministic paths; signed URLs returned.

* QC checklist passes end-to-end with sample sheet.

---

# **“Do/Don’t” for Claude Code**

**Do**

* Generate typed zod schemas; fail fast with problem+json responses.

* Add pino structured logging \+ requestId \+ jobId.

* Wrap all outbound calls (Sheets, Vertex, Gemini) with retry/backoff.

* Provide seed scripts, sample CSVs, and Postman collection.

**Don’t**

* Don’t put business logic in Apps Script.

* Don’t accept arbitrary Veo params or pass fps/duration to Gemini Image.

* Don’t write unbatched, per-cell updates to Sheets.

