# QC Checklist - Image-Only MVP Verification

**Date**: 2025-01-09  
**Version**: 1.0.0  
**Service**: AI Asset Orchestrator  

## Test Environment Setup

```bash
export API_BASE=http://localhost:9090
export GCS_BUCKET=solid-study-467023-i3-ai-assets
export PROJECT_ID=solid-study-467023-i3
```

## ⚙️ Pre-Deployment Testing

### Infrastructure Readiness
- [ ] **GCS Bucket**: Created with lifecycle rules and CORS settings
- [ ] **Pub/Sub**: Topic and subscription configured with DLQ
- [ ] **Service Account**: Created with minimal required permissions
- [ ] **Secrets**: API keys stored in Secret Manager
- [ ] **Environment Variables**: All required vars set in Cloud Run

### Build and Deployment
- [ ] **Code Quality**: All tests passing (`pnpm test`)
- [ ] **Linting**: No linting errors (`pnpm lint`)
- [ ] **Type Safety**: TypeScript compilation clean (`pnpm typecheck`)
- [ ] **Docker Build**: Container builds without errors
- [ ] **Cloud Build**: Pipeline completes successfully
- [ ] **Health Check**: `/healthz` returns 200 after deployment

## 🔧 Functional Testing

### API Endpoints

#### Health Endpoints
- [ ] `GET /healthz` returns 200 with service info
- [ ] `GET /readiness` returns 200 with dependency status
- [ ] Response includes timestamp and version

#### Image Generation Endpoint
- [ ] **Valid Request**: `POST /batch/images` with valid payload returns 202
- [ ] **Dry Run**: `runMode: "dry_run"` returns cost estimate without API calls
- [ ] **Live Run**: `runMode: "live"` enqueues jobs and returns batch ID
- [ ] **Batch Size Limit**: >10 rows rejected with 400
- [ ] **Variant Limit**: >3 variants per row rejected with 400
- [ ] **Rate Limiting**: Consecutive requests within 10min rejected with 429
- [ ] **Invalid Schema**: Malformed requests rejected with 400
- [ ] **Missing Fields**: Requests without required fields rejected with 400

#### Video Generation Endpoint (Phase 2)
- [ ] **Phase 1**: `POST /batch/videos` returns 501 "feature disabled"
- [ ] **Schema Ready**: Video schema validation works (logs but doesn't reject)
- [ ] **Future Proof**: Route exists and can be enabled

#### Status Endpoint
- [ ] `GET /status/{jobId}` returns job information
- [ ] **Invalid UUID**: Malformed job IDs rejected with 400
- [ ] **Not Found**: Non-existent jobs return appropriate response
- [ ] **Batch Status**: `POST /status/batch` handles multiple job IDs

### Input Validation

#### Scene ID Validation
- [ ] **Valid**: Alphanumeric with hyphens/underscores accepted
- [ ] **Length**: 1-50 characters enforced
- [ ] **Invalid Characters**: Special characters rejected
- [ ] **Empty**: Empty scene IDs rejected

#### Prompt Validation
- [ ] **Length**: 1-1000 characters enforced
- [ ] **Content**: Basic profanity filtering works
- [ ] **Encoding**: Unicode characters handled correctly
- [ ] **Injection**: No code injection vulnerabilities

#### URL Validation
- [ ] **Format**: Only HTTPS URLs accepted
- [ ] **GCS URLs**: Only storage.googleapis.com URLs for ref packs
- [ ] **Accessibility**: URLs are validated for accessibility
- [ ] **Signed URLs**: Expired signed URLs rejected

### Cost Estimation
- [ ] **Image Cost**: $0.002 per image calculated correctly
- [ ] **Batch Cost**: Multiple rows summed correctly
- [ ] **Variants**: Different variant counts calculated correctly
- [ ] **Rounding**: Costs displayed with appropriate precision
- [ ] **Zero Cost**: Dry runs return $0 actual cost

## 🎨 Image Generation Testing

### Gemini Client Testing
- [ ] **Mock Mode**: Returns mock images with correct structure
- [ ] **Path Generation**: GCS paths follow `images/{campaign}/{scene_id}/{job_id}/var_N.png`
- [ ] **Thumbnails**: Thumbnail paths generated correctly
- [ ] **Error Handling**: Network errors handled gracefully
- [ ] **Retry Logic**: Exponential backoff on failures
- [ ] **Rate Limiting**: API rate limits respected

### GCS Integration
- [ ] **Upload**: Mock images uploaded to correct paths
- [ ] **Signed URLs**: Generated with 7-day expiry
- [ ] **Permissions**: Service account can read/write bucket
- [ ] **Lifecycle**: Lifecycle rules configured for 90-day deletion
- [ ] **CORS**: Browser access works for signed URLs

### Pub/Sub Integration
- [ ] **Message Publishing**: Jobs enqueued successfully
- [ ] **Message Format**: Messages contain all required fields
- [ ] **Subscription**: Messages consumed by worker
- [ ] **Error Handling**: Failed messages sent to DLQ
- [ ] **Acknowledgment**: Messages acknowledged after processing

## 📊 Apps Script Testing

### Menu Installation
- [ ] **Menu Appears**: Custom "AI Generation" menu visible
- [ ] **Menu Items**: All expected items present and clickable
- [ ] **Permissions**: Script has necessary Sheet permissions
- [ ] **Trigger**: onOpen trigger installed and working

### Row Selection
- [ ] **Single Row**: Selecting one row works correctly
- [ ] **Multiple Rows**: Selecting multiple rows works correctly
- [ ] **Header Skip**: Header row ignored correctly
- [ ] **Empty Selection**: Error message for no selection
- [ ] **Max Limit**: Error message when >10 rows selected

### API Communication
- [ ] **Network Call**: UrlFetch successfully calls backend
- [ ] **Request Format**: JSON payload correctly formatted
- [ ] **Response Handling**: API responses parsed correctly
- [ ] **Error Display**: Network errors shown to user
- [ ] **Timeout**: Calls complete within Apps Script limits

### User Interface
- [ ] **Dry Run Dialog**: Shows correct count and cost estimate
- [ ] **Confirmation Dialog**: Requires "CONFIRM" input for live runs
- [ ] **Success Messages**: Success feedback displayed
- [ ] **Error Messages**: Clear error messages displayed
- [ ] **Help Dialog**: Help information accurate and useful

## 🔄 End-to-End Testing

### Complete Image Workflow
1. [ ] **Setup**: Create test sheet with sample data
2. [ ] **Selection**: Select 2-3 rows with valid data
3. [ ] **Dry Run**: Execute dry run, verify cost estimate
4. [ ] **Live Run**: Execute live run with confirmation
5. [ ] **Processing**: Verify jobs appear in backend logs
6. [ ] **Completion**: Check images appear in sheet (mock URLs)
7. [ ] **Status**: Verify status updates correctly

### Data Flow Testing
- [ ] **Sheet → API**: Data correctly extracted from sheet
- [ ] **API → Pub/Sub**: Jobs correctly enqueued
- [ ] **Pub/Sub → Worker**: Messages correctly processed
- [ ] **Worker → GCS**: Assets uploaded to storage
- [ ] **Worker → Sheet**: Results written back to sheet
- [ ] **Error Flow**: Errors propagated and displayed correctly

### Edge Cases
- [ ] **Empty Prompts**: Handled gracefully
- [ ] **Invalid URLs**: Rejected appropriately  
- [ ] **Duplicate Scene IDs**: Idempotency works
- [ ] **Network Failures**: Retry logic works
- [ ] **Quota Exhaustion**: Rate limits enforced
- [ ] **Large Batches**: Performance acceptable

## 🎬 Video Testing (Phase 2)

### Veo Client Testing
- [ ] **Constraint Enforcement**: Hard limits on duration/fps/aspect enforced
- [ ] **Model Selection**: Both Veo 3 and Veo 3 Fast supported
- [ ] **Seed Image**: Approved images used correctly
- [ ] **Output Format**: MP4 files generated correctly
- [ ] **Error Handling**: API errors handled gracefully

### Video Workflow
1. [ ] **Image Approval**: Producer sets approved_image_url
2. [ ] **Status Update**: status_video changed to ready_to_queue  
3. [ ] **Video Generation**: Menu item enabled and working
4. [ ] **Cost Confirmation**: Higher costs require confirmation
5. [ ] **Processing**: Video jobs processed correctly
6. [ ] **Output**: Video URLs written to sheet

## 🔒 Security Testing

### Authentication
- [ ] **Service Account**: Proper ADC authentication
- [ ] **Permissions**: Minimal required permissions only
- [ ] **Secrets**: No secrets in code or logs
- [ ] **API Keys**: Stored in Secret Manager

### Input Sanitization
- [ ] **SQL Injection**: No database injection vulnerabilities
- [ ] **Script Injection**: No XSS vulnerabilities in responses
- [ ] **Path Traversal**: No file system access outside allowed paths
- [ ] **Command Injection**: No shell command vulnerabilities

### Rate Limiting
- [ ] **User Limits**: Per-user rate limits enforced
- [ ] **Global Limits**: Project-wide limits enforced
- [ ] **Budget Limits**: Cost limits enforced
- [ ] **Abuse Prevention**: Rapid requests blocked

## 📈 Performance Testing

### Load Testing
- [ ] **Concurrent Users**: 10 concurrent users handled
- [ ] **Batch Processing**: Large batches (10 rows) handled
- [ ] **Memory Usage**: No memory leaks under load
- [ ] **Response Times**: API responses <5 seconds
- [ ] **Timeout Handling**: Long operations don't timeout

### Scalability
- [ ] **Auto-scaling**: Cloud Run scales under load
- [ ] **Pub/Sub**: Message processing scales correctly
- [ ] **GCS**: Storage operations performant
- [ ] **Cold Start**: Acceptable cold start performance

## 🚨 Error Recovery Testing

### Service Failures
- [ ] **Gemini API Down**: Graceful degradation
- [ ] **GCS Unavailable**: Proper error messages
- [ ] **Pub/Sub Issues**: Messages not lost
- [ ] **Sheets API Errors**: Retry logic works
- [ ] **Network Partitions**: Recovery after reconnection

### Data Consistency
- [ ] **Partial Failures**: No orphaned data
- [ ] **Retry Idempotency**: Retries don't create duplicates
- [ ] **State Recovery**: System recovers to consistent state
- [ ] **Cleanup**: Failed jobs properly cleaned up

## 📋 User Acceptance Testing

### Producer Workflow
- [ ] **Intuitive**: Workflow is clear without training
- [ ] **Error Messages**: Errors are actionable and clear
- [ ] **Performance**: System feels responsive
- [ ] **Reliability**: Works consistently across browser sessions
- [ ] **Mobile**: Basic functionality works on mobile devices

### Admin Operations
- [ ] **Monitoring**: Logs provide sufficient debugging info
- [ ] **Alerting**: Errors trigger appropriate alerts
- [ ] **Cost Tracking**: Spend is visible and accurate
- [ ] **User Management**: Rate limits work per user
- [ ] **Maintenance**: System can be updated without downtime

## ✅ Deployment Acceptance Criteria

### Phase 1 Go-Live Checklist
- [ ] All functional tests passing
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Monitoring and alerting configured
- [ ] Rollback plan prepared
- [ ] User training materials ready

### Phase 2 Upgrade Checklist
- [ ] Video endpoints enabled and tested
- [ ] Veo constraints properly enforced
- [ ] Cost controls working for video
- [ ] Migration from Sheets to Firestore (if applicable)
- [ ] UI updates deployed and working
- [ ] User communication completed

This checklist should be executed before each deployment and any failures must be resolved before proceeding to production.