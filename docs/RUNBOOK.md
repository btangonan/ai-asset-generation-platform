# Producer Runbook: AI Asset Generation

Step-by-step guide for creative teams to generate AI assets using the platform.

## 🎯 Overview

This platform lets you generate AI images and videos using Google Sheets as your control surface. Simply fill out the sheet, select rows, and click menu items to generate assets.

## 📋 Prerequisites

### Access Required
- [ ] Google Sheets access to the project sheet
- [ ] Apps Script menu installed and working
- [ ] Understanding of your daily budget limits
- [ ] Reference pack images uploaded to GCS

### Browser Setup
- Use Chrome or Firefox (avoid Safari for file uploads)
- Enable cookies and JavaScript
- Disable popup blockers for this domain

## 🏗 Sheet Setup

### Column Schema
Your sheet must have these columns (exact names matter):

| Column | Purpose | Example |
|--------|---------|---------|
| `scene_id` | Unique identifier | `SEQ01-001`, `VAR-kitchen-01` |
| `mode` | Workflow type | `variation` or `sequence` |
| `prompt` | Text description | `Warm cinematic kitchen, morning light` |
| `ref_pack_id` | Reference ID | `RP-kitchen-cozy` |
| `ref_pack_url` | Drive folder link | `https://drive.google.com/drive/folders/...` |
| `ref_pack_public_urls` | Array of GCS signed URLs | `["https://storage.googleapis.com/..."]` |
| `reference_mode` | How to use references | `style_only` or `style_and_composition` |
| `status_img` | Image status | `queued`, `running`, `awaiting_review`, `error` |
| `nano_img_1` | Generated image 1 | (auto-filled) |
| `nano_img_2` | Generated image 2 | (auto-filled) |
| `nano_img_3` | Generated image 3 | (auto-filled) |

### Future-Proofed Columns (Phase 2)
These columns exist but are not used yet:

| Column | Purpose | Default Value |
|--------|---------|---------------|
| `approved_image_url` | Producer selection | (empty) |
| `veo_model` | Video model | `veo3_fast` |
| `aspect` | Video ratio | `16:9` |
| `resolution` | Video quality | `720` |
| `duration_s` | Video length | `8` (locked) |
| `fps` | Frame rate | `24` (locked) |
| `status_video` | Video status | `ready_to_queue` |
| `video_url` | Generated video | (empty) |

## 🖼️ Reference Images (NEW)

### Overview
The system now supports reference image conditioning for AI image generation. You can provide up to 6 reference images per row to guide the style and composition of generated images.

### Reference Modes
- **`style_only`** (default): Uses references for aesthetic/style guidance while creating entirely new compositions
- **`style_and_composition`**: Maintains both the visual style AND compositional structure of references

### Setting Up References

1. **Upload Reference Images to GCS**
   - Maximum 6 images per generation
   - Supported formats: JPG, PNG, WebP
   - Maximum size: 10MB per image
   - Optimal resolution: 720p-1080p

2. **Add Reference URLs to Sheet**
   ```
   ref_pack_public_urls: [
     "https://storage.googleapis.com/bucket/ref1.jpg",
     "https://storage.googleapis.com/bucket/ref2.jpg"
   ]
   reference_mode: style_only
   ```

3. **Reference Best Practices**
   - Use consistent style across reference images
   - Higher quality references = better results
   - Clear, uncluttered subjects work best
   - Match lighting/mood to your prompt

## 🎨 Image Generation Workflow

### Step 1: Prepare Your Data

1. **Fill Required Columns**
   ```
   scene_id: SEQ01-001
   mode: sequence
   prompt: Cozy kitchen interior, warm lighting, coffee brewing
   ref_pack_public_urls: ["url1", "url2"] (optional, up to 6)
   reference_mode: style_only (optional)
   ```

2. **Validate Data**
   - Scene IDs must be unique
   - Prompts should be 10-1000 characters
   - Reference URLs must be accessible signed URLs
   - Maximum 6 reference images per row
   - Status should be `queued` for new rows

### Step 2: Generate Images (Dry Run)

1. **Select Rows**: Click on row numbers to select (not cells)
2. **Open Menu**: AI Generation → Generate Images (Dry-Run)
3. **Review Estimate**:
   ```
   Rows selected: 5
   Total images: 15 (3 variants each)
   Estimated cost: $0.030
   ```
4. **Click OK** to confirm dry run

### Step 3: Generate Images (Live)

1. **Select Same Rows** as dry run
2. **Open Menu**: AI Generation → Generate Images (Live)
3. **Confirm Generation**:
   - Review cost estimate
   - Type `CONFIRM` exactly
   - Click OK
4. **Wait for Processing**:
   - Status changes to `running`
   - Images appear in 2-5 minutes
   - Status changes to `awaiting_review`

### Step 4: Review Results

1. **Check Generated Images**:
   - `nano_img_1`, `nano_img_2`, `nano_img_3` columns populate with thumbnail links
   - Click links to view full images
   - Images are 720x720px by default

2. **Select Best Variant**:
   - Copy URL from best image
   - Paste into `approved_image_url` column
   - This will be used for video generation in Phase 2

## 🎬 Video Generation (Phase 2)

*Video generation will be available in Phase 2. The workflow will be:*

1. Ensure `approved_image_url` is set
2. Configure `veo_model`, `aspect`, `resolution`
3. Select rows → AI Generation → Generate Video
4. Confirm estimated cost
5. Wait for video generation
6. Review results in `video_url` column

## ⚠️ Limits and Guardrails

### Batch Limits
- **Maximum 10 rows** per batch
- **Maximum 3 variants** per row
- **10-minute cooldown** between batches per user

### Cost Limits
- Dry run is always free (no API calls made)
- Daily budget caps apply (check with admin)
- Image generation: ~$0.002 per image
- Video generation: ~$0.10-0.50 per 8-second clip

### Quality Guidelines
- **Prompt length**: 10-1000 characters optimal
- **Reference images**: 3-10 images per ref pack
- **Avoid copyrighted content** in prompts or references
- **Clear, specific descriptions** work better than vague ones

## 📊 Monitoring Your Jobs

### Job Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `queued` | Ready to process | Wait or select for generation |
| `running` | Currently processing | Wait (2-5 minutes typical) |
| `awaiting_review` | Images ready | Review and approve one |
| `error` | Something failed | Check error message, retry if needed |

### Check Job Status
1. **Menu**: AI Generation → Check Status
2. **View Summary**:
   ```
   Running jobs: 3
   Completed jobs: 12
   ```
3. **Individual Status**: Check `status_img` column for details

## 🚨 Troubleshooting

### Common Issues

**"No data rows selected"**
- Click on row numbers (1, 2, 3), not cells
- Make sure you're below the header row
- Try selecting again

**"Missing required columns"**
- Verify column names are exact (case-sensitive)
- Check for typos: `scene_id` not `scene ID`
- Ensure no hidden columns

**"Rate limited - please wait X minutes"**
- You've hit the cooldown period
- Wait the specified time before trying again
- Consider batching more rows together

**"Invalid ref_pack_public_url"**
- URL must be a valid HTTPS link
- GCS signed URLs expire after 7 days
- Contact admin for fresh signed URLs

**Images not appearing after 10+ minutes**
- Check Google Cloud Console logs
- Verify your ref pack URLs are accessible
- Try a smaller batch (1-2 rows) to test

### Getting Help

1. **Check Status**: Use "Check Status" menu first
2. **Review Logs**: Admin can check Cloud Console
3. **Test Small**: Try 1 row first to isolate issues
4. **Contact Support**: Include your `scene_id` and timestamp

## ✅ Quality Checklist

Before submitting large batches:

- [ ] Test with 1-2 rows first
- [ ] All required columns filled
- [ ] Reference URLs are working
- [ ] Prompts are clear and specific
- [ ] Budget available for the batch
- [ ] No duplicate scene_ids

## 📈 Best Practices

### Efficient Workflows
1. **Batch Similar Scenes**: Group by style or theme
2. **Prepare Reference Packs**: Upload and organize beforehand
3. **Use Descriptive scene_ids**: `SEQ01-kitchen-wide` vs `001`
4. **Start Small**: Test prompts with 1 variant first

### Prompt Writing Tips
- **Be specific**: "Cozy kitchen with warm wood cabinets" vs "nice kitchen"
- **Include lighting**: "soft morning light", "dramatic sunset"
- **Specify mood**: "intimate", "energetic", "peaceful"
- **Avoid negatives**: Say what you want, not what you don't want

### Reference Pack Strategy
- **3-5 images minimum** for good style transfer
- **Consistent style/lighting** across reference images
- **High quality source images** (1080p+)
- **Clear subject matter** (avoid busy/cluttered refs)

This runbook will be updated as new features are added in Phase 2!