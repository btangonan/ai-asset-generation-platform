# Hybrid v1 Testing & Deployment Plan
## AI Asset Generation Platform - Reference Management Evolution

### Executive Summary
This plan outlines the testing and deployment strategy for the Hybrid v1 architecture implementing "Sheets brain, Web eyes" pattern with SSE progress tracking, GCS state management, and SHA-256 reference deduplication.

**Timeline**: 4 weeks from testing to full production
**Risk Level**: Medium (new architecture patterns, Cloud Run SSE compatibility)
**Rollback Strategy**: Feature flags with legacy blob URL fallback

---

## Phase 1: Local Testing (Days 1-3)

### 1.1 Unit Testing
```bash
# Run new unit tests
pnpm --filter orchestrator test src/lib/ref-merge.test.ts

# Full test suite
pnpm --filter orchestrator test

# TypeScript compilation check
pnpm --filter orchestrator build
```

### 1.2 Component Verification Checklist
- [ ] **Reference Merge Logic**
  - SHA-256 hashing generates unique content identifiers
  - Per-row refs prioritized over global refs
  - Deduplication works for identical URLs
  - Cap at 6 references enforced
  
- [ ] **SSE Progress Endpoint**
  - `/progress/:batchId` streams updates
  - 2-second polling interval works
  - Disconnection cleanup triggers
  - JSON state updates parse correctly
  
- [ ] **GCS Ledger**
  - State files save to `jobs/{batchId}/state.json`
  - State retrieval works for existing jobs
  - Non-existent jobs return null gracefully
  
- [ ] **Integration Points**
  - `images.ts` creates initial job state
  - Updates propagate to ledger during processing
  - Reference images merge correctly in pipeline

### 1.3 Local Environment Setup
```bash
# Environment variables
export GOOGLE_CLOUD_PROJECT=solid-study-467023-i3
export GCS_BUCKET=test-bucket-local
export GEMINI_API_KEY=test-key
export WEB_APP_URL=http://localhost:3000
export RUN_MODE=dry_run

# Start services
pnpm --filter orchestrator dev  # Backend on :9090
pnpm --filter batch-ui dev      # Web UI on :3000
```

---

## Phase 2: Integration Testing (Days 4-7)

### 2.1 End-to-End Workflow Tests

#### Test Case 1: Basic Image Generation with References
```javascript
// Apps Script test
function testBasicGeneration() {
  const testData = {
    items: [{
      scene_id: "TEST-001",
      prompt: "cyberpunk city",
      ref_pack_public_urls: [
        { url: "https://example.com/ref1.jpg", mode: "style_only" },
        { url: "https://example.com/ref2.jpg", mode: "style_only" }
      ],
      variants: 2
    }],
    runMode: "dry_run"
  };
  
  // POST to backend
  const response = UrlFetchApp.fetch(`${CONFIG.API_BASE_URL}/batch/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(testData)
  });
  
  // Verify batch ID returned
  const result = JSON.parse(response.getContentText());
  console.log('Batch ID:', result.batchId);
}
```

#### Test Case 2: SSE Progress Monitoring
```javascript
// Web app test
const eventSource = new EventSource(`/api/progress/${batchId}`);
eventSource.onmessage = (event) => {
  const state = JSON.parse(event.data);
  console.assert(state.status === 'running', 'Job should be running');
  console.assert(state.progress >= 0 && state.progress <= 1, 'Progress in range');
};
```

#### Test Case 3: Reference Deduplication
```javascript
// Test identical references get deduplicated
const duplicateRefs = [
  { url: "https://example.com/same.jpg", mode: "style_only" },
  { url: "https://example.com/same.jpg", mode: "style_only" }, // Duplicate
  { url: "https://example.com/different.jpg", mode: "style_only" }
];
// Expected: Only 2 unique references processed
```

### 2.2 Error Scenario Testing
- [ ] Network failure during SSE streaming
- [ ] GCS unavailable during state write
- [ ] Malformed request to `/batch/images`
- [ ] Reference URLs return 404
- [ ] Batch exceeds 10 row limit
- [ ] Invalid API key authentication

### 2.3 Load Testing
```bash
# 10 concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:9090/batch/images \
    -H "Content-Type: application/json" \
    -d '{"items":[{"scene_id":"LOAD-'$i'","prompt":"test","variants":1}],"runMode":"dry_run"}' &
done

# Monitor resource usage
docker stats
```

---

## Phase 3: Staging Deployment (Week 2)

### 3.1 Staging Environment Setup
```bash
# Create staging Cloud Run service
gcloud run deploy orchestrator-staging \
  --image us-central1-docker.pkg.dev/solid-study-467023-i3/orchestrator/orchestrator:staging \
  --region us-central1 \
  --platform managed \
  --memory 512Mi \
  --timeout 600s \
  --set-env-vars "GCS_BUCKET=staging-ai-assets,RUN_MODE=dry_run"

# Staging GCS bucket
gsutil mb gs://staging-ai-assets
gsutil iam ch allUsers:objectViewer gs://staging-ai-assets
```

### 3.2 Staging Test Matrix

| Test Scenario | Scale | Duration | Success Criteria |
|--------------|-------|----------|------------------|
| Single row generation | 1 row | 30s | Complete with SSE updates |
| Small batch | 10 rows | 2 min | All rows process, state persists |
| Large batch | 100 rows | 10 min | No timeouts, <10 min completion |
| Reference dedup | 50 refs → 6 | 1 min | 88% reduction rate |
| SSE stability | 1 hr connection | 1 hr | No disconnections |
| Concurrent users | 5 users | 30 min | All batches complete |

### 3.3 Cloud Run Specific Tests
- [ ] SSE works through Cloud Run proxy
- [ ] 600s timeout sufficient for 100 rows
- [ ] Memory usage stays under 512Mi
- [ ] Cold start time < 5 seconds
- [ ] Auto-scaling handles load spikes

---

## Phase 4: Production Rollout (Week 3)

### 4.1 Feature Flag Implementation
```javascript
// Backend feature flag
const HYBRID_V1_ENABLED = {
  'user1@example.com': true,  // 10% rollout
  'user2@example.com': true,
  'default': false  // Legacy blob URLs
};

function shouldUseHybridV1(userId) {
  return HYBRID_V1_ENABLED[userId] || HYBRID_V1_ENABLED['default'];
}
```

### 4.2 Rollout Schedule

| Day | Rollout % | User Segment | Monitoring Focus |
|-----|-----------|--------------|------------------|
| 1 | 10% | Power users | SSE stability, errors |
| 3 | 25% | Early adopters | Reference dedup rate |
| 5 | 50% | Half of users | GCS state persistence |
| 7 | 100% | All users | Overall performance |

### 4.3 Blue-Green Deployment
```bash
# Deploy new version (green)
gcloud run deploy orchestrator-green \
  --image us-central1-docker.pkg.dev/.../orchestrator:v1.1.0

# Test green deployment
curl https://orchestrator-green-xxx.run.app/healthz

# Switch traffic
gcloud run services update-traffic orchestrator \
  --to-tags green=100

# Keep blue as instant rollback
gcloud run services update-traffic orchestrator \
  --to-tags blue=100  # If issues arise
```

### 4.4 Production Checklist
- [ ] Database backups completed
- [ ] Feature flags configured
- [ ] Monitoring dashboards ready
- [ ] Rollback procedure documented
- [ ] Support team briefed
- [ ] User communication sent

---

## Phase 5: Monitoring & Observability (Ongoing)

### 5.1 Key Metrics Dashboard

```yaml
metrics:
  - name: sse_connection_duration
    description: How long SSE connections stay alive
    threshold: >30 seconds
    alert: <10 seconds
    
  - name: reference_dedup_rate
    description: Percentage of duplicate refs removed
    threshold: >40%
    target: >60%
    
  - name: batch_completion_time
    description: Time to process full batch
    threshold: <10 min for 100 rows
    alert: >15 minutes
    
  - name: gcs_state_operations
    description: Ledger read/write performance
    threshold: <500ms per op
    alert: >2000ms
    
  - name: error_rate
    description: Failed batches / total batches
    threshold: <5%
    alert: >10%
```

### 5.2 Alerting Rules
```yaml
alerts:
  - name: SSE Connection Failures
    condition: rate(sse_disconnections) > 10/min
    severity: HIGH
    action: Page on-call engineer
    
  - name: GCS State Corruption
    condition: gcs_state_parse_errors > 0
    severity: CRITICAL
    action: Immediate investigation
    
  - name: Reference Processing Slow
    condition: p95(ref_merge_time) > 5s
    severity: MEDIUM
    action: Investigate during business hours
    
  - name: Batch Queue Backup
    condition: pending_batches > 100
    severity: HIGH
    action: Scale up Cloud Run instances
```

### 5.3 Logging Strategy
```javascript
// Structured logging for analysis
logger.info({
  event: 'batch_started',
  batchId,
  itemCount: items.length,
  referenceCount: refs.length,
  dedupCount: dedupedRefs.length,
  timestamp: new Date().toISOString()
});
```

---

## Phase 6: Risk Mitigation

### 6.1 Identified Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| SSE drops on Cloud Run timeout | Medium | High | Implement heartbeat every 30s, auto-reconnect |
| GCS state file corruption | Low | Critical | Versioned states, hourly backups |
| Reference URLs expire mid-batch | Medium | Medium | Refresh signed URLs every 5 min |
| Apps Script 6-min timeout | Low | High | Already fixed with single POST |
| Cost overrun from large batches | Medium | High | Hard limits: 10 rows, 3 variants, dry_run default |
| SHA-256 collision | Very Low | Low | Use full hash, not truncated |

### 6.2 Rollback Procedures

#### Immediate Rollback (< 5 minutes)
```bash
# Route traffic back to previous version
gcloud run services update-traffic orchestrator \
  --to-revisions orchestrator-00010-lf2=100

# Disable feature flags
UPDATE feature_flags SET enabled = false WHERE feature = 'hybrid_v1';
```

#### Data Recovery
```bash
# Restore GCS state from backup
gsutil cp gs://backup-bucket/states/* gs://production-bucket/jobs/

# Reprocess failed batches
SELECT * FROM job_log WHERE status = 'failed' AND timestamp > '2025-01-01';
```

---

## Success Criteria & Exit Gates

### Week 1 Exit Gate (Local Testing)
- ✅ All unit tests pass
- ✅ TypeScript compilation clean
- ✅ Manual testing of reference merge works
- ✅ SSE streams updates locally

### Week 2 Exit Gate (Staging)
- ✅ 100-row batch completes in <10 minutes
- ✅ SSE stable for 1-hour connections
- ✅ Reference deduplication >50% efficiency
- ✅ Zero data loss in GCS

### Week 3 Exit Gate (Production Soft Launch)
- ✅ 10% rollout with <5% error rate
- ✅ P95 latency <2 seconds
- ✅ No critical alerts for 48 hours
- ✅ Positive user feedback

### Week 4 Success Metrics
- ✅ 99% SSE connection reliability
- ✅ <2s ledger state updates
- ✅ 60%+ reference deduplication rate
- ✅ 100% data integrity in GCS
- ✅ 100-row batches complete reliably

---

## Appendix A: Test Commands

```bash
# Build and test locally
pnpm install
pnpm --filter orchestrator build
pnpm --filter orchestrator test

# Deploy to staging
gcloud builds submit --tag staging
gcloud run deploy orchestrator-staging

# Monitor logs
gcloud run logs read --service orchestrator-staging

# Load test
ab -n 100 -c 10 -p test-payload.json \
  -T application/json \
  https://orchestrator-staging.run.app/batch/images
```

## Appendix B: Emergency Contacts

- **Technical Lead**: [Your Name]
- **Cloud Run Support**: cloud-run-support@google.com
- **On-Call Engineer**: Use PagerDuty
- **Escalation**: CTO for production issues

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Next Review**: After Week 1 testing complete