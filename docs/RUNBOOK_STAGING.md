# Staging Deploy & Test Runbook (10 minutes)

## Prerequisites
- gcloud CLI authenticated
- pnpm installed
- API key configured

## Deployment Steps

### 1. Deploy with no traffic (2 min)
```bash
make deploy-staging PROJECT=solid-study-467023-i3 SERVICE=orchestrator REGION=us-central1
```
Wait for deployment to complete. Note the revision ID for potential rollback.

### 2. Promote to latest (30 sec)
```bash
make promote PROJECT=solid-study-467023-i3 SERVICE=orchestrator REGION=us-central1
```
This routes 100% traffic to the new revision.

### 3. Smoke test (30 sec)
```bash
URL=https://orchestrator-us-central1.run.app make smoke
```
Verify:
- `/healthz` returns 200 with "healthy" status
- `/metrics-lite` returns counters object

### 4. Dry-run 100 rows (2 min)
```bash
export AI_PLATFORM_API_KEY_1=aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc
URL=https://orchestrator-us-central1.run.app make test-100
```
Success criteria:
- Completes in <10 minutes
- Error rate <5%
- No GCS writes (dry run)

### 5. Live 10 rows - CAUTION (1 min)
```bash
URL=https://orchestrator-us-central1.run.app make live-10
```
This will:
- Generate real images
- Write to GCS
- Incur costs (~$0.02)

### 6. Verify ledger (30 sec)
```bash
gsutil cat gs://solid-study-467023-i3-ai-assets/ledger/$(date +%F).jsonl | tail -n 10
```
Confirm:
- JSONL lines present
- Costs match expectations
- RequestIds populated

## Rollback Procedure

If any issues occur:
```bash
# Get previous good revision
gcloud run revisions list --service orchestrator --region us-central1

# Rollback to specific revision
REV=orchestrator-00009-abc make rollback
```

## Production Promotion

Once staging validated:
1. Set `RUN_MODE=live` in production environment
2. Deploy to production service
3. Monitor `/metrics-lite` for 30 minutes
4. Check ledger for cost tracking

## Monitoring

Watch these metrics:
- Request rate: Should be <100/min
- Error rate: Should be <5%
- Response time: p95 <400ms
- Cost accumulation: Should match daily budget

## Alerts

Set up log-based alerts for:
- Error rate >5% in 5 minutes
- Response time >1s
- Budget exceeded events
- Circuit breaker opens

## Contact

Issues: Create GitHub issue
Urgent: Check Cloud Run logs first