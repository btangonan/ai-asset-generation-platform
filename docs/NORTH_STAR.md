# North Star

Ship a trustworthy, manual-only AI asset pipeline that a producer can run from a Sheet in under 60 seconds. Human chooses. System guards. Costs visible.

## Non-negotiables

- **Manual spend only.** No auto-runs. Dry-run is the default.
- **One click → one POST.** Apps Script never loops per row.
- **Signed URLs only.** No public GCS.
- **Keyless auth.** ADC + service accounts. No JSON keys in code or images.
- **Sheets is a UI.** Firestore (or DB) is the source of truth.
- **Exact model specs enforced server-side.** Reject unsupported params.
- **Honest errors.** Never return 200 on failure. Use RFC 7807 responses.

## Scope guardrails

### In:
- Image ideation (Nano Banana) and short video (Veo 3 / Veo 3 Fast).
- Google Sheets menu + optional sidebar. GCS storage. Cloud Run API.
- Cost previews, rate limits, idempotency, structured logging.

### Out (until proven need):
- Auto-batch schedulers. Background cron spend.
- Realtime websockets, custom CDN, or multi-tenant UI.
- Fine-grained RBAC, complex approval queues.
- Any feature that adds more ops than producer value.

## UX rules (producer-first)

- **Menu items:** Generate Images (Dry-Run), Generate Images (Live), Generate Video, Open Sidebar.
- **Confirmations:** Live runs require typed count. Video runs show total cost before send.
- **Status model:**
  - Images: `queued` → `running` → `awaiting_review`.
  - Videos: `ready_to_queue` → `queued` → `running` → `done|error`.
- **Sidebar does only two things well:** show thumbnails, set approved_image_url.
- **Selection truth is scene_id.** Never trust filtered ranges blindly.

## API contracts (simple and strict)

### POST /batch/images
```json
Body: { 
  items: [{scene_id, prompt, ref_pack_public_url?, variants:1|2|3}], 
  runMode: 'dry_run'|'live' 
}
```
Reject >10 rows or variants>3 with 400.

### POST /batch/videos
```json
Body: { 
  items: [{scene_id, approved_image_url, veo_model, aspect:'16:9'|'9:16', resolution:720|1080}], 
  runMode, 
  confirmCount 
}
```
Enforce fps=24 and duration=8 on server.

### GET /status/:jobId 
→ stable envelope with last state and links.

**All responses:** RFC 7807 on 4xx/5xx. No HTML. No stack traces.

## Model rules

**Nano Banana (Gemini 2.5 Flash Image):** prompt + refs only. No fps/duration/resolution knobs. Encourage "style-only" phrasing in prompt.

**Veo 3 / Veo 3 Fast (Vertex):** aspect 16:9 or 9:16. resolution 720 or 1080. fps 24. length 8s. Split requests to respect per-request output caps.

## Cost and safety

- **Config in Sheet:** COST_PER_IMAGE, RATES_VEO_*. Backend computes and logs cost_estimate.
- **Per user:** at most one image batch per 10 minutes.
- **Per click:** ≤10 rows. Global in-flight caps to prevent pileups.
- **Idempotency key:** sha256(scene_id + provider + normalizedPromptOrSeed + day_bucket). 24-hour dedupe.
- **RUN_MODE flag at server:** dry_run|live. Default dry_run. Hard stop if budget breached.

## Storage rules

- **GCS is canonical.** Store gs://… in ledger; return signed HTTPS to Sheet. Default TTL 7 days.
- **UBLA + PAP enforced.** No allUsers permissions. Lifecycle: delete variants after 90 days. Preserve "gold" refs.

## Reliability

- **Health:** /healthz = process up. /readyz = GCS + (Pub/Sub when enabled).
- **Retries:** truncated exponential backoff on Sheets, GCS, Vertex/Gemini (max 3–4 attempts). Surface final errors to user.
- **Reconcile:** if Sheet write fails, ledger holds truth; "Reconcile Sheet" menu resyncs statuses and links.

## Observability

**Log fields on every job:** requestId, jobId, scene_id, user, provider, variants, cost_estimate, duration_ms, outcome.

**Alerts (log-based):**
- 5xx rate > 2% for 5 minutes.
- Signed URL generation failures > 0 for 5 minutes.
- DLQ count > 0 (when queue is on).

## SLOs (simple and testable)

- **Availability (API):** 99.5% monthly.
- **p95 POST /batch/images dry-run:** ≤ 800 ms.
- **Writeback success:** ≥ 99% within 30 s of job finish.
- **Duplicate spend:** 0 from idempotency failures.

## Build and deploy minimalism

- Monorepo with pnpm. Two stages: build, run. .dockerignore mandatory.
- Server listens on PORT || 8080, host 0.0.0.0. Graceful SIGTERM within 10 seconds.
- Cloud Run only. No dev tunnels in docs. Apps Script CONFIG points to Cloud Run URL.
- One start script per service. One stop script. No auto-respawn in dev.

## Security

- No secrets in code, logs, or images.
- Google: ADC + service accounts. Third-party keys from Secret Manager at deploy time.
- Logger redacts headers and config. Never log envs.
- Zod .strict() on all inputs. Reject unknown fields.

## Code constraints

- Small files. Prefer ≤300 LOC per file.
- Typed config module using Zod. Never read process.env in business logic.
- Single-responsibility functions. No god modules.
- Unit tests for schemas, clients, cost calc. One happy-path E2E.

## Decision filter (use this to kill bloat)

Ask these five before adding anything:

1. Does this make a producer faster this week?
2. Can we ship it without new infra?
3. Can a human still approve spend?
4. Can we roll it back in 5 minutes?
5. Can we measure its value in the logs within 24 hours?

**If any answer is "no," defer.**

## "Do / Don't"

### Do:
- Batch updates to Sheets.
- Return signed URLs and short, human error messages.
- Keep Apps Script thin; one POST per action.

### Don't:
- Add background automations that spend money.
- Expose public GCS objects.
- Build a second UI before the Sheet is frictionless.

## Acceptance checklist (ship gate)

- [ ] Menu appears. Dry-run computes cost via API. Live requires typed confirmation.
- [ ] Images end at awaiting_review with thumbs. Approval writes approved_image_url.
- [ ] Videos reject any non-spec param.
- [ ] Duplicate clicks don't double-spend.
- [ ] Logs show request → cost → outcome. Alerts work.

## How we evolve without drift

- ADR for any new provider or storage change.
- Feature flags for provider choice and rate limits.
- Additions must preserve: manual spend, one-click one-POST, signed URLs only, Sheet as UI, ledger as truth.

---

**Pin this to docs/NORTH_STAR.md. Treat it as law. When you feel bloat creeping in, run the Decision filter. If it fails, cut it.**