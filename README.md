# 🤖 AI Asset Generation Platform

**Status**: ✅ **LIVE IN PRODUCTION**  
**Service URL**: https://orchestrator-582559442661.us-central1.run.app  
**Last Updated**: September 6, 2025

A production-ready AI asset generation platform using Google Sheets as the UI and Google Cloud Run as the backend. Generate professional AI images using Gemini 2.5 Flash with reference image conditioning and batch processing capabilities.

## 🎯 **PRODUCTION DEPLOYMENT STATUS**

✅ **Live Service**: https://orchestrator-582559442661.us-central1.run.app  
✅ **Health Check**: All monitoring endpoints operational  
✅ **Security**: 100% audit complete, P1 fixes applied  
✅ **Features**: Real AI image generation with Gemini 2.5 Flash ("Nano Banana")  
✅ **Reference Images**: Multi-modal prompting with up to 6 reference images  

## 🚀 **Quick Start for Users**

### **For Producers & Creative Teams**
1. **Access Your Google Sheet** with the configured Apps Script menu
2. **Fill in your scene data**: `scene_id`, `prompt`, optional `ref_pack_public_urls`
3. **Select rows** → **AI Generation** → **Generate Images (Dry-Run)** to preview
4. **Select rows** → **AI Generation** → **Generate Images (Live)** to generate real images
5. **Review results** in `nano_img_1`, `nano_img_2`, `nano_img_3` columns

**📖 Full Guide**: See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for complete workflow documentation

### **For Developers**
```bash
# Local development setup
git clone <this-repository>
cd vertex_system
pnpm install && pnpm build

# Configure environment
cp apps/orchestrator/.env.local.example apps/orchestrator/.env.local
# Edit .env.local with your Google Cloud project and API keys

# Start development server
pnpm dev
# Server available at http://localhost:9090
```

## 🏗 **Architecture**

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Google Sheets     │    │   Cloud Run          │    │  Google Cloud   │
│   + Apps Script     ├────┤   Orchestrator       ├────┤  Services       │
│   (User Interface)  │    │   (FastAPI Backend)  │    │  (GCS, Gemini)  │
└─────────────────────┘    └──────────────────────┘    └─────────────────┘
```

### **Core Components**
- **Frontend**: Google Sheets with Apps Script UI (Phase 1) → React Web App (Phase 2)
- **Backend**: Fastify TypeScript service on Cloud Run (`apps/orchestrator/`)
- **AI Generation**: Gemini 2.5 Flash Image with reference image conditioning
- **Storage**: Google Cloud Storage with signed URLs and thumbnail generation
- **Future**: Video generation with Veo 3 (Phase 2 ready)

### **Key Features**
- 🎨 **AI Image Generation**: Gemini 2.5 Flash with 1024x1024 output
- 📸 **Reference Images**: Multi-modal prompting with style/composition control
- 🔄 **Batch Processing**: Up to 10 rows, 3 variants each, cost estimation
- 🔐 **Enterprise Security**: API key authentication, input validation, rate limiting
- 📊 **Production Monitoring**: Health checks, metrics, structured logging
- 💰 **Cost Controls**: Dry-run mode, batch limits, usage tracking

## 📋 **API Endpoints**

### **Production Endpoints**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/healthz` | GET | Health check | ✅ Live |
| `/readiness` | GET | Readiness check | ✅ Live |
| `/metrics` | GET | System metrics | ✅ Live |
| `/batch/images` | POST | AI image generation | ✅ Live |
| `/batch/sheets` | POST | Google Sheets integration | ✅ Live |
| `/upload-reference` | POST | Reference image upload | 🔄 Pending deployment |

### **Example API Usage**
```bash
# Generate AI images (requires API key)
curl -X POST https://orchestrator-582559442661.us-central1.run.app/batch/images \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "scene_id": "test-001",
        "prompt": "A cozy kitchen with warm lighting and modern appliances",
        "variants": 2,
        "ref_pack_public_urls": ["https://storage.googleapis.com/bucket/ref1.jpg"],
        "reference_mode": "style_only"
      }
    ],
    "runMode": "live"
  }'
```

## 🔧 **Development**

### **Project Structure**
```
apps/orchestrator/          # Main FastAPI service
├── src/
│   ├── routes/            # API endpoints
│   ├── lib/              # Utilities (auth, GCS, logging)
│   └── workers/          # Pub/Sub workers
packages/
├── shared/               # Types and schemas
├── clients/             # AI model clients (Gemini, Veo)
└── sheets/              # Google Sheets integration
tools/
├── apps_script/         # Google Apps Script UI
└── batch-ui/           # Web UI (Phase 2)
```

### **Available Scripts**
```bash
# Development
pnpm dev                 # Start development server
pnpm build              # Build all packages
pnpm test               # Run test suite
pnpm lint               # Lint code
pnpm typecheck          # TypeScript validation

# Deployment
pnpm --filter orchestrator build    # Build orchestrator only
# See deployment section below
```

### **Environment Configuration**
Key environment variables (see `.env.local.example`):
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET=your-assets-bucket
GEMINI_API_KEY=your-gemini-api-key
AI_PLATFORM_API_KEY_1=your-client-api-key
RUN_MODE=live  # or 'dry_run'
PORT=9090
```

## 🚀 **Production Deployment**

### **Current Production Setup**
- **Service**: `orchestrator` on Google Cloud Run
- **Project**: `solid-study-467023-i3`
- **Region**: `us-central1`
- **Container**: Multi-stage Docker build with production optimizations
- **Resources**: 512Mi memory, 1 vCPU, 600s timeout

### **Deployment Commands**
```bash
# Build and deploy new version
PROJECT=solid-study-467023-i3
REGION=us-central1
REPO=orchestrator
IMAGE_TAG=production-$(date +%Y%m%d-%H%M%S)

# Build container
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/$REPO/orchestrator:$IMAGE_TAG

# Deploy to Cloud Run
gcloud run deploy orchestrator \
  --image $REGION-docker.pkg.dev/$PROJECT/$REPO/orchestrator:$IMAGE_TAG \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --service-account orchestrator-sa@$PROJECT.iam.gserviceaccount.com
```

### **Deployment Validation**
After deployment, verify all endpoints:
```bash
SERVICE_URL="https://orchestrator-582559442661.us-central1.run.app"
curl -f $SERVICE_URL/healthz    # Should return 200
curl -f $SERVICE_URL/readiness  # Should return 200
curl -f $SERVICE_URL/metrics    # Should return 200
```

## 📚 **Documentation**

- **[RUNBOOK.md](docs/RUNBOOK.md)** - Complete user workflow guide
- **[CLAUDE.md](docs/CLAUDE.md)** - Development guide and patterns
- **[CRITICAL_STATUS.md](CRITICAL_STATUS.md)** - Current system status
- **[INTEGRITY_AUDIT.md](INTEGRITY_AUDIT.md)** - Security and compliance report

## 🔒 **Security & Compliance**

- ✅ **Authentication**: Cryptographic API keys with timing attack protection
- ✅ **Input Validation**: Zod strict schemas preventing injection attacks
- ✅ **Error Handling**: RFC 7807 Problem Details standard
- ✅ **Rate Limiting**: Configurable per-user and global limits
- ✅ **Container Security**: Multi-stage builds, non-root user
- ✅ **Secret Management**: Google Secret Manager integration
- ✅ **Audit Status**: 100% production ready, all P1 issues resolved

## 💡 **Features**

### **Phase 1 (Current)**
- ✅ AI Image Generation with Gemini 2.5 Flash
- ✅ Reference Image Conditioning (up to 6 images)
- ✅ Google Sheets UI with Apps Script
- ✅ Batch Processing with cost estimation
- ✅ GCS storage with signed URLs and thumbnails
- ✅ Production monitoring and health checks

### **Phase 2 (Planned)**
- 📅 Video Generation with Veo 3
- 📅 React Web UI
- 📅 Advanced workflow management
- 📅 Enhanced analytics and reporting

## 🆘 **Support & Troubleshooting**

### **Common Issues**
- **Authentication errors**: Verify API key format (`aip_...`) and permissions
- **Rate limiting**: Wait for cooldown period or contact admin for limits
- **Reference image errors**: Check URLs are accessible and under 10MB

### **Getting Help**
1. Check service health: `curl https://orchestrator-582559442661.us-central1.run.app/healthz`
2. Review logs in Google Cloud Console
3. Consult documentation in `docs/` directory
4. For production issues, include scene_id and timestamp

## 📊 **System Status**

**Live Service**: https://orchestrator-582559442661.us-central1.run.app  
**Health**: ✅ All systems operational  
**Security**: ✅ 100% audit complete  
**Features**: ✅ Real AI generation active  
**Last Audit**: September 6, 2025 - 100% production ready

---

**Built with TypeScript, Fastify, Google Cloud, and Gemini AI**