# AI Asset Generation Platform – Project Overview

## 🌌 North Star
Enable creative teams to ideate (Nano Banana stills) and execute (Veo 3 video) with:
- Human control (manual-only, no auto-spend)
- Familiar UX (Google Sheets / Web App front-end)
- Reliable infra (Cloud Run, Pub/Sub, GCS, optional Firestore)
- Guardrails: spec locks, budget visibility, structured logging
- Extendable to scale with Firestore + BigQuery for durable job ledger and analytics

---
## 🚀 Current MVP State
- ✅ Local orchestrator service (Fastify, Node 20, TypeScript)
- ✅ API endpoints for image (Nano Banana mock / Gemini Image) and video (Veo stub)
- ✅ GCS storage pipeline with signed URLs (7-day expiry)
- ✅ Sheets integration (custom menu + sidebar)
- ✅ Placeholder image generation (SVG → PNG, Sharp)
- ✅ Cost estimates in Sheets ($0.002 per image)
- ⚠️ Pub/Sub not fully configured (default project binding issue)
- ⚠️ Gemini client still mocked (real integration pending)
- ⚠️ Zombie process leaks during dev (needs process manager fix)

---
## 🛠️ Tech Stack
**Frontend UI**
- Google Sheets custom menu + sidebar (Apps Script)
- Minimal Web App (Next.js planned for evolution)

**Backend Orchestrator**
- Node 20 + TypeScript
- Fastify API server
- pnpm monorepo

**Cloud Infrastructure**
- Google Cloud Run (stateless orchestrator service)
- Google Cloud Storage (canonical store, signed URLs)
- Google Pub/Sub (async job queue, not yet stable)
- (Optional) Firestore (durable job ledger, audit trail)

**Models**
- Nano Banana (Gemini 2.5 Flash Image)
  - Input: prompt + refs
  - Output: up to 3 PNGs, ~720×720
  - Constraints: no fps/duration/resolution params
- Veo 3 / Veo 3 Fast (Vertex AI)
  - Input: approved still + strict params (aspect 16:9|9:16, res 720/1080, fps=24, duration=8s)
  - Output: 2–4 MP4 clips

**Other**
- Zod for strict schema validation
- Sharp for image resizing/thumbnails
- Pino structured logging
- Terraform optional for infra provisioning

---
## 🔒 Governance & Guardrails
- Dry-run mode: default, shows counts/est. cost without spend
- Manual-only runs: require confirmation before spend
- Rate limits: 1 image batch per user per 10min, Veo RPM caps
- Hard spec locks: reject unsupported model params
- Idempotency: job_id = hash(scene_id + model + approved_image_url + day_bucket)
- Error handling: exponential backoff on 429/5xx
- Security: service account impersonation, no JSON keys, all URLs signed
- Data lifecycle: GCS auto-delete variants after 90 days

---
## 🧪 Testing & Validation
- Unit tests: Zod schemas, cost calc, clients
- E2E smoke: sheet → images → approve → video → URLs written back
- Attack vector suite: 68 tests (SQLi, XSS, path traversal, JSON bombs, etc.)
- Current: 66/68 passing (~97% coverage)

---
## 📋 Near-Term Roadmap (0–3 months)
**P0**
- Fix Pub/Sub project ID binding (queue jobs properly)
- Replace Gemini mock with real Nano Banana integration
- Kill zombie processes (pnpm watch → nodemon/pm2)

**P1**
- Harden error handling (problem+json, retries)
- Lock down GCS bucket (UBLA, no public ACLs)
- Add cost ledger to Firestore

**P2**
- Cloud Run production deployment (orchestrator HTTPS)
- Web App MVP (drag-drop refs, batch prompt input, approvals view)
- Structured monitoring (Cloud Logging, Monitoring, alerts)

---
## 🔮 Future Plans (6–18 months)
- Replace Sheets UI with full Web App (React/Next.js)
- Multi-user support with Firestore auth + approvals
- Cost dashboards with BigQuery/Looker
- Multi-tenant architecture for agencies
- AI provider abstraction layer (Gemini, Imagen, Stability, OpenAI)
- SynthID watermark verification pipeline (compliance)
- Video editing assist (automatic animatic assembly from Veo outputs)

---
## ⚠️ Known Issues & Risks
- Zombie processes during local dev (resource leaks)
- Cloud Run deployment intermittently fails (env var validation)
- LocalTunnel unstable for Apps Script → API testing
- Sheets quotas (20k UrlFetch/day, 6min runtime)
- Risk of cost overrun without hard guardrails

---
## 📈 Evolution Plan
**Phase 1 (Now)**: MVP with Sheets UI, Nano Banana images, GCS signed URLs  
**Phase 2**: Pub/Sub + Firestore ledger, Web App MVP for producers  
**Phase 3**: Real Veo 3 integration, multi-user cost governance, monitoring  
**Phase 4**: Scalable production system with agency-ready features  

---
## 📌 Key Principles (North Star Rules)
1. **Simplicity over bloat** – smallest feature set that gets real creative work done
2. **Manual-first** – no auto-spend, producers always confirm
3. **Spec fidelity** – reject any unsupported params at API boundary
4. **Logs > DB early** – rely on structured logs + GCS metadata until Firestore is needed
5. **UI is thin** – Sheets or web app never holds state; backend/ledger is source of truth
