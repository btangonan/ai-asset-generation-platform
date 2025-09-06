# Gemini 2.5 Flash Nano Banana Image Generation Integration Assessment

## Context for ChatGPT Analysis

We need expert guidance on integrating **Gemini 2.5 Flash with Nano Banana image generation capabilities** into our existing AI Asset Generation Platform. Please review our current implementation and provide specific recommendations for proper integration.

## Current System Architecture

### Tech Stack
- **Runtime**: Node.js v23.11.0
- **Language**: TypeScript 5.x
- **Framework**: Fastify 5.1.0
- **Package Manager**: pnpm (monorepo)
- **Cloud Provider**: Google Cloud Platform
- **Storage**: Google Cloud Storage (GCS)
- **API Key**: [REDACTED-EXPOSED-KEY]

### Project Structure
```
vertex_system/
├── apps/
│   └── orchestrator/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── images.ts      # Image generation endpoints
│       │   │   └── sheets.ts      # Google Sheets integration
│       │   └── lib/
│       │       ├── image-generator.ts  # NEEDS UPDATE FOR GEMINI 2.5
│       │       └── gcs.ts         # GCS operations
│       └── .env.local
└── packages/
    └── clients/
        └── src/
            └── gemini-image-client.ts  # Gemini client wrapper
```

## Current Implementation Status

### 1. Working Components
- ✅ Google Sheets integration (reads prompts, writes results)
- ✅ GCS upload with signed URLs (7-day expiration)
- ✅ Thumbnail generation (128px using Sharp)
- ✅ Batch processing pipeline
- ✅ Cost estimation ($0.002 per image)

### 2. Current Image Generation Code (PLACEHOLDER)
```typescript
// apps/orchestrator/src/lib/image-generator.ts
import sharp from 'sharp';
import { putObject } from './gcs.js';
import { env } from './env.js';
import { logger } from './logger.js';

export async function generateAndUploadImage(
  sceneId: string,
  prompt: string,
  variant: number
): Promise<{ url: string; thumbnailUrl?: string }> {
  // Currently generates SVG placeholders
  const svg = generatePlaceholderSVG(prompt, sceneId, variant);
  imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  
  // Need to replace with actual Gemini 2.5 Flash API call
}
```

### 3. Environment Variables
```env
GEMINI_API_KEY=[REDACTED-EXPOSED-KEY]
GOOGLE_CLOUD_PROJECT=solid-study-467023-i3
GCS_BUCKET=solid-study-467023-i3-ai-assets
```

## Critical Questions for Gemini 2.5 Flash Integration

### 1. API Endpoint & Authentication
- What is the correct API endpoint for Gemini 2.5 Flash with Nano Banana image generation?
- Is it `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`?
- Does it use the same API key authentication or requires OAuth?

### 2. Request Format
- What's the exact request payload structure for image generation?
- Example structure we're considering:
```json
{
  "contents": [{
    "parts": [{
      "text": "Generate an image: [prompt here]"
    }]
  }],
  "generationConfig": {
    "temperature": 0.7,
    "candidateCount": 1,
    "maxOutputTokens": 8192,
    "responseModalities": ["image"],
    "imageGenerationConfig": {
      "numberOfImages": 1,
      "aspectRatio": "1:1",
      "negativePrompt": "",
      "personGeneration": "allow_all",
      "digitalArtStyle": "unspecified",
      "language": "en"
    }
  }
}
```

### 3. Response Handling
- What format does the image come back in? (base64, URL, binary?)
- Does it return multiple images per request?
- What's the response structure?

### 4. Model Capabilities
- Is "gemini-2.5-flash" the correct model identifier?
- What are the image size limitations? (1024x1024?)
- Can it generate multiple variants in one API call?
- What's the rate limit for image generation?

### 5. Error Handling
- What error codes should we handle?
- Is there a fallback if image generation fails?
- How to handle quota exceeded errors?

## Proposed Implementation Plan

```typescript
// Proposed update for image-generator.ts
async function generateWithGemini25Flash(prompt: string): Promise<Buffer> {
  const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
  const requestBody = {
    contents: [{
      parts: [{
        text: `Generate an image: ${prompt}`
      }]
    }],
    generationConfig: {
      responseModalities: ["image"],
      // What other configs needed?
    }
  };
  
  const response = await fetch(`${API_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  // How to extract image from response?
  const data = await response.json();
  // Return Buffer from base64 or download from URL?
}
```

## Specific Technical Concerns

1. **API Version**: Is v1beta still current or should we use v1/v2?
2. **Image Format**: Does Gemini return PNG, JPEG, or another format?
3. **Size Control**: How to specify output dimensions (we need 1024x1024)?
4. **Batch Processing**: Can we send multiple prompts in one request?
5. **Cost**: What's the actual cost per image with Gemini 2.5 Flash?
6. **Streaming**: Does the API support streaming for large images?
7. **Seeds**: Can we set seeds for reproducible generation?

## Test Cases We Need to Support

1. Simple prompt: "A sunset over mountains"
2. Complex prompt: "Modern office space with plants, minimalist design, warm lighting"
3. Multiple variants: Generate 3 variations of the same prompt
4. Error case: Invalid/inappropriate prompt handling
5. Large batch: Process 10+ images consecutively

## Current Error We're Seeing

When attempting to use the API, we get:
```
WARN: Gemini image generation failed, using placeholder
error: "geminiClient.generateImage is not a function"
```

This suggests the Gemini API doesn't have a direct `generateImage` method. We need to know the correct method name and structure.

## Deliverables Needed from ChatGPT

1. **Exact API documentation** for Gemini 2.5 Flash image generation
2. **Complete working code example** in TypeScript/Node.js
3. **Error handling patterns** for common failure scenarios
4. **Rate limiting strategy** to avoid quota issues
5. **Best practices** for prompt engineering with Gemini 2.5
6. **Confirmation** that Nano Banana is the image generation feature name
7. **Alternative approaches** if Gemini 2.5 Flash doesn't support direct image generation

## Additional Context

- We're already successfully using the Gemini API key for other operations
- The system needs to generate images in real-time (not async/webhook)
- Images must be uploaded to GCS immediately after generation
- We need both full-size and thumbnail versions
- The solution must work with our existing TypeScript/Node.js stack

Please provide a detailed technical implementation guide with exact code that we can use to replace our placeholder image generation with real Gemini 2.5 Flash Nano Banana image generation.