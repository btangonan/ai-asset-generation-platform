# AI Asset Generation Platform

A production-ready TypeScript platform for generating AI assets using Google Sheets as the UI and Cloud Run as the backend. Phase 1 supports image generation via Gemini 2.5 Flash Image, with full future-proofing for video generation.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Google Cloud Project with billing enabled
- Google Sheets document

### Local Development

```bash
# Clone and install dependencies
git clone <repository-url>
cd ai-asset-generation-platform
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Build all packages
pnpm build

# Start development server
pnpm dev
```

### Production Deployment

```bash
# Deploy infrastructure
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project settings
terraform init
terraform plan
terraform apply

# Deploy application
gcloud builds submit --config=infra/cloudbuild.yaml
```

## 🏗 Architecture

```
Google Sheets (UI) → Apps Script → Cloud Run API → Pub/Sub → AI Models → GCS → Sheet Updates
```

### Components

- **apps/orchestrator**: Core Fastify service with REST API
- **packages/shared**: Types, schemas, and error definitions
- **packages/clients**: AI model clients (Gemini, Vertex Veo)
- **packages/sheets**: Google Sheets API helper
- **tools/apps_script**: Ultra-thin UI for Google Sheets
- **infra/**: Terraform and Cloud Build configuration

## 📊 Features

### Phase 1 (Current)
- ✅ Image generation via Gemini 2.5 Flash Image
- ✅ Google Sheets UI with custom menu
- ✅ Batch processing with rate limits
- ✅ Cost estimation and dry-run mode
- ✅ GCS storage with signed URLs
- ✅ Future-proofed for video generation

### Phase 2 (Planned)
- 🔄 Video generation via Veo 3/Veo 3 Fast
- 🔄 Advanced cost controls
- 🔄 Firestore state management
- 🔄 Web UI replacement for scale

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET=your-project-ai-renders

# API Keys
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_SHEETS_API_KEY=your-sheets-api-key

# Rate Limiting
MAX_ROWS_PER_BATCH=10
USER_COOLDOWN_MINUTES=10
RUN_MODE=dry_run
```

### Google Sheets Setup

1. Create a new Google Sheet
2. Set up column headers (see `docs/RUNBOOK.md` for schema)
3. Install the Apps Script UI (`tools/apps_script/Code.gs`)
4. Update `CONFIG.API_BASE_URL` in Apps Script

## 📚 Documentation

- **[RUNBOOK.md](docs/RUNBOOK.md)**: Producer workflow and usage guide
- **[GUARDRAILS.md](docs/GUARDRAILS.md)**: Model specs and safety controls
- **[CLAUDE.md](docs/CLAUDE.md)**: Development guidelines for AI assistants
- **[QC_CHECKLIST.md](docs/QC_CHECKLIST.md)**: Quality assurance testing guide

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm --filter shared test
pnpm --filter orchestrator test

# Run E2E tests
pnpm test:e2e
```

## 🔒 Security

- Service account authentication with minimal IAM permissions
- Signed GCS URLs with 7-day expiration
- Input validation with Zod schemas
- Rate limiting and quota management
- No sensitive data in logs

## 📈 Monitoring

Health check endpoints:
- `GET /healthz` - Basic health status
- `GET /readiness` - Dependency health checks
- `GET /status/:jobId` - Job status tracking

## 🛠 Development

### Project Structure
```
├─ apps/orchestrator/          # Main Fastify service
├─ packages/
│  ├─ shared/                  # Types and schemas
│  ├─ clients/                 # AI model clients
│  └─ sheets/                  # Google Sheets helper
├─ tools/apps_script/          # Google Sheets UI
├─ infra/                      # Infrastructure as code
└─ docs/                       # Documentation
```

### Adding New Features

1. Update schemas in `packages/shared`
2. Implement client logic in `packages/clients`
3. Add API routes in `apps/orchestrator/src/routes`
4. Update Apps Script UI if needed
5. Add tests and documentation

### Code Quality

```bash
# Linting and formatting
pnpm lint
pnpm format

# Type checking
pnpm typecheck
```

## 🚀 Deployment

### Cloud Build
Automated deployment via Cloud Build:
- Builds and tests all packages
- Creates Docker container
- Deploys to Cloud Run
- Runs health checks

### Manual Deployment
```bash
# Build Docker image
docker build -f apps/orchestrator/Dockerfile -t ai-orchestrator .

# Deploy to Cloud Run
gcloud run deploy ai-orchestrator \
  --image gcr.io/PROJECT_ID/ai-orchestrator \
  --region us-central1 \
  --allow-unauthenticated
```

## 📞 Support

For issues and questions:
1. Check the documentation in `docs/`
2. Review logs in Google Cloud Console
3. Use the QC checklist for debugging
4. Contact the development team

## 🔮 Future Roadmap

- **Q2 2024**: Phase 2 with video generation
- **Q3 2024**: Web UI replacement
- **Q4 2024**: Multi-tenant architecture
- **2025**: Advanced workflow automation

## 📄 License

This project is proprietary. All rights reserved.