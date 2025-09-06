# AI Asset Generation Platform - Personal Testing Guide

## 🚀 Quick Start Testing

### Prerequisites
- Google Cloud Project: `solid-study-467023-i3`
- GCS Bucket: `solid-study-467023-i3-ai-assets`
- Service running on: `http://localhost:9090`

## 📊 Google Sheets Integration

### Setting Up Your Test Sheet

1. **Create a Google Sheet** with the following columns:
   - `scene_id` - Unique identifier for the scene (e.g., "beach-sunset-001")
   - `prompt` - Your image generation prompt
   - `variants` - Number of variations to generate (1-3)
   - `status` - Will be updated by the system (pending/processing/completed/failed)
   - `job_id` - System-generated job identifier
   - `results` - JSON array of generated image URLs

### Example Sheet Structure
```
| scene_id      | prompt                                    | variants | status  | job_id | results |
|---------------|-------------------------------------------|----------|---------|--------|---------|
| landscape-001 | Serene mountain landscape at golden hour | 2        | pending |        |         |
| portrait-001  | Professional headshot in studio lighting | 3        | pending |        |         |
```

### Connecting Your Sheet
1. Get your Google Sheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
   - Extract the `SHEET_ID` portion

2. Update the system configuration (if needed) in your API calls

## 🖼️ Testing Image Generation

### 1. Direct API Testing (Recommended for Testing)

#### Single Image Generation
```bash
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "scene_id": "test-scene-001",
        "prompt": "A serene mountain landscape with a lake at sunset",
        "variants": 2
      }
    ],
    "runMode": "live"
  }'
```

#### Batch Image Generation
```bash
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "scene_id": "beach-001",
        "prompt": "Tropical beach with palm trees",
        "variants": 2
      },
      {
        "scene_id": "forest-001",
        "prompt": "Dense forest with morning fog",
        "variants": 3
      },
      {
        "scene_id": "city-001",
        "prompt": "Modern city skyline at night",
        "variants": 1
      }
    ],
    "runMode": "live"
  }'
```

### 2. Testing with Different Run Modes

#### Dry Run Mode (Testing without actual generation)
```bash
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "scene_id": "dry-run-test",
        "prompt": "Test prompt for dry run",
        "variants": 1
      }
    ],
    "runMode": "dry_run"
  }'
```

### 3. Check Job Status
```bash
curl http://localhost:9090/status/[JOB_ID]
```

## 📁 Adding Reference Images

### Upload Reference Images to GCS

1. **Using gsutil (Command Line)**:
```bash
# Upload a single reference image
gsutil cp /path/to/reference.jpg \
  gs://solid-study-467023-i3-ai-assets/references/

# Upload multiple reference images
gsutil -m cp /path/to/references/*.jpg \
  gs://solid-study-467023-i3-ai-assets/references/
```

2. **Using Google Cloud Console**:
   - Navigate to: https://console.cloud.google.com/storage/browser/solid-study-467023-i3-ai-assets
   - Create a folder called `references`
   - Upload your reference images

3. **Reference Image Naming Convention**:
```
references/
├── style-references/
│   ├── watercolor-style.jpg
│   ├── oil-painting-style.jpg
│   └── digital-art-style.jpg
├── composition-references/
│   ├── rule-of-thirds.jpg
│   └── golden-ratio.jpg
└── color-references/
    ├── warm-palette.jpg
    └── cool-palette.jpg
```

## 🔍 Monitoring & Health Checks

### System Health
```bash
# Basic health check
curl http://localhost:9090/healthz

# Readiness check (includes dependency checks)
curl http://localhost:9090/readiness

# Detailed metrics
curl http://localhost:9090/metrics
```

### View Generated Images

1. **Direct GCS Browser Access**:
   - URL: https://console.cloud.google.com/storage/browser/solid-study-467023-i3-ai-assets/images
   - Navigate to: `images/[scene_id]/[job_id]/`
   - Files:
     - `var_1.png`, `var_2.png`, etc. - Full-size images
     - `thumb_1.png`, `thumb_2.png`, etc. - 128px thumbnails

2. **Using Signed URLs from API Response**:
   - The API returns signed URLs that are valid for 10 years
   - Example response:
   ```json
   {
     "job_id": "batch_1234567890_abc123",
     "status": "completed",
     "results": [
       {
         "variant_num": 1,
         "image_url": "https://storage.googleapis.com/...",
         "thumb_url": "https://storage.googleapis.com/..."
       }
     ]
   }
   ```

## 🧪 Testing Scenarios

### Test Case 1: Basic Image Generation
```bash
# Generate a single image
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "scene_id": "basic-test",
      "prompt": "A simple red circle on white background",
      "variants": 1
    }],
    "runMode": "live"
  }'
```

### Test Case 2: Multiple Variants
```bash
# Generate 3 variants of the same prompt
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "scene_id": "variant-test",
      "prompt": "Abstract geometric patterns in blue and green",
      "variants": 3
    }],
    "runMode": "live"
  }'
```

### Test Case 3: Batch Processing
```bash
# Process multiple scenes in one request
curl -X POST http://localhost:9090/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"scene_id": "batch-1", "prompt": "Sunrise over mountains", "variants": 2},
      {"scene_id": "batch-2", "prompt": "Ocean waves at night", "variants": 2},
      {"scene_id": "batch-3", "prompt": "Desert landscape", "variants": 1}
    ],
    "runMode": "live"
  }'
```

## 🛠️ Running the System

### Start the Development Server
```bash
cd /Users/bradleytangonan/Desktop/my\ apps/vertex_system/apps/orchestrator

# Run with live mode (actual image generation)
GOOGLE_CLOUD_PROJECT=solid-study-467023-i3 \
GCS_BUCKET=solid-study-467023-i3-ai-assets \
GEMINI_API_KEY=AIzaSyAYI_vahKNtws_H8e4j7U8S00yx-RvMD-8 \
RUN_MODE=live \
PORT=9090 \
pnpm dev
```

### Environment Variables Explained
- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
- `GCS_BUCKET`: Storage bucket for generated images
- `GEMINI_API_KEY`: API key for Gemini (currently using placeholder generation)
- `RUN_MODE`: `live` for actual generation, `dry_run` for testing
- `PORT`: Server port (default: 9090)

## 📝 Testing Checklist

- [ ] Server is running on port 9090
- [ ] Health check returns healthy status
- [ ] Readiness check shows all dependencies are ready
- [ ] Can generate single image via API
- [ ] Can generate multiple variants
- [ ] Can process batch requests
- [ ] Images are uploaded to GCS
- [ ] Signed URLs are accessible
- [ ] Thumbnails are generated correctly
- [ ] Reference images can be uploaded to GCS

## 🔧 Troubleshooting

### Common Issues and Solutions

1. **404 Not Found Error**
   - Ensure you're using `/batch/images` not `/images`
   - Check server is running on port 9090

2. **Schema Validation Errors**
   - Ensure request body matches the expected format
   - Required fields: `items` array with `scene_id`, `prompt`, `variants`

3. **GCS Upload Failures**
   - Check service account permissions
   - Verify bucket exists and is accessible
   - Check if impersonation is configured correctly

4. **Image Generation Not Working**
   - Currently using placeholder SVG generation
   - Real Gemini integration pending
   - Check `RUN_MODE` is set to `live`

## 📊 Performance Testing

### Run the Soak Test
```bash
cd /Users/bradleytangonan/Desktop/my\ apps/vertex_system/apps/orchestrator
npx tsx scripts/soak-test.ts
```

### Quick Performance Test
```bash
npx tsx scripts/quick-soak-test.ts
```

## 🔗 Useful Links

- **GCS Bucket**: https://console.cloud.google.com/storage/browser/solid-study-467023-i3-ai-assets
- **Google Cloud Console**: https://console.cloud.google.com/home/dashboard?project=solid-study-467023-i3
- **API Documentation**: See `/batch/images` endpoint in `src/routes/images.ts`
- **Health Dashboard**: http://localhost:9090/healthz
- **Metrics**: http://localhost:9090/metrics

## 📌 Notes

- The system currently generates placeholder SVG images converted to PNG
- Real image generation with Gemini/Vertex AI can be integrated once API access is configured
- Signed URLs are set to expire in 10 years (effectively permanent)
- Maximum 10 rows per batch, 3 variants per row
- All images include 128px thumbnails automatically