# API Setup Guide

Follow these steps to set up real APIs for the AI Asset Generation Platform.

## Prerequisites

- Google Cloud CLI installed (`gcloud`)
- Google Cloud account with billing enabled
- Node.js and pnpm installed

## Quick Setup (5 minutes)

### 1. Google Cloud Console Setup

1. **Create Project**: https://console.cloud.google.com/projectcreate
2. **Enable APIs**: Go to APIs & Services > Library and enable:
   - Vertex AI API
   - Cloud Storage API
   - Google Sheets API (optional)

### 2. Get Gemini API Key

**Option A: Google AI Studio (Easiest)**
1. Go to https://makersuite.google.com/
2. Click "Get API Key"
3. Copy the key (starts with `AIza...`)

**Option B: Google Cloud Vertex AI (Production)**
1. Use service account authentication (more secure)
2. Better for production deployments

### 3. Run Setup Scripts

```bash
# Navigate to project directory
cd /path/to/vertex_system

# 1. Set up Google Cloud Storage
./scripts/setup-gcs.sh
# Edit the PROJECT_ID in the script first!

# 2. Set up authentication (optional, for production)
./scripts/setup-auth.sh
# Edit the PROJECT_ID in the script first!
```

### 4. Configure Environment

```bash
# Copy and edit production environment
cd apps/orchestrator
cp .env.production.template .env.production

# Edit .env.production with your values:
# - GOOGLE_CLOUD_PROJECT=your-project-id
# - GCS_BUCKET=your-bucket-name
# - GEMINI_API_KEY=your-api-key
```

### 5. Test Your Setup

```bash
# Test with real APIs
GOOGLE_CLOUD_PROJECT=your-project \
GCS_BUCKET=your-bucket \
GEMINI_API_KEY=your-key \
RUN_MODE=dry_run \
pnpm --filter orchestrator dev
```

## API Costs (Approximate)

- **Gemini 2.5 Flash Image**: $0.002 per image
- **Google Cloud Storage**: ~$0.02 per GB/month
- **Google Sheets API**: Free (with quotas)

## Security Best Practices

✅ **Never commit API keys to git**
✅ **Use service accounts in production**  
✅ **Enable billing alerts**
✅ **Set up IAM permissions properly**
✅ **Use environment variables**

## Switching Between Mock and Live

The system supports both modes:

```bash
# Mock mode (for development)
RUN_MODE=dry_run pnpm dev

# Live mode (with real APIs)  
RUN_MODE=live pnpm dev
```

## Troubleshooting

### Common Issues:

1. **"Project not found"**: Check PROJECT_ID is correct
2. **"Permission denied"**: Verify service account has proper roles
3. **"API not enabled"**: Enable required APIs in Cloud Console
4. **"Quota exceeded"**: Check API quotas and billing

### Getting Help:

- Google Cloud Console: https://console.cloud.google.com/
- Google AI Studio: https://makersuite.google.com/
- API Documentation: https://cloud.google.com/vertex-ai/docs

## Next Steps

Once APIs are set up:

1. Deploy to Google Cloud Run
2. Set up monitoring and logging
3. Configure production Google Sheets
4. Set up automated backups

See `DEPLOYMENT.md` for deployment instructions.