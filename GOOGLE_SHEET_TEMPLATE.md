# Google Sheet Template Guide

This guide shows how to set up your Google Sheet for the AI Asset Generation Platform.

## 📋 Required Column Structure

Your Google Sheet **must** have these columns in Row 1 (headers):

| Column | Header Name | Type | Description | Example |
|--------|-------------|------|-------------|---------|
| A | `scene_id` | **Required** | Unique identifier for each scene | `scene-001` |
| B | `prompt` | **Required** | AI image generation prompt | `A majestic mountain landscape at sunset` |
| C | `variants` | Optional | Number of variants to generate (1-3) | `2` |
| D | `status_img` | Optional | Processing status | `pending`, `completed`, `error`, `running` |
| E | `nano_img_1` | Output | First generated image URL | *Auto-populated* |
| F | `nano_img_2` | Output | Second generated image URL | *Auto-populated* |
| G | `nano_img_3` | Output | Third generated image URL | *Auto-populated* |
| H | `job_id` | Output | Batch processing job ID | *Auto-populated* |
| I | `error_msg` | Output | Error message if generation fails | *Auto-populated* |
| J | `cost` | Output | **Per-row cost tracking** | `$0.0040` |

## 🆕 Cost Column Details (v1.1.0)

The new **`cost` column (Column J)** provides real-time cost tracking:

- **Format**: `$0.0040` (4 decimal places)
- **Calculation**: `variants × $0.002` per image
- **Examples**: 
  - 1 variant = `$0.0020`
  - 2 variants = `$0.0040` 
  - 3 variants = `$0.0060`
- **Auto-populated**: System writes cost after processing each row

## 📝 Sample Sheet Structure

```
| scene_id  | prompt                              | variants | status_img | nano_img_1 | nano_img_2 | nano_img_3 | job_id | error_msg | cost    |
|-----------|-------------------------------------|----------|------------|------------|------------|------------|--------|-----------|---------|
| scene-001 | A majestic mountain landscape       | 2        | pending    |            |            |            |        |           |         |
| scene-002 | Modern minimalist office space     | 1        | pending    |            |            |            |        |           |         |
| scene-003 | Cyberpunk city at night           | 3        | pending    |            |            |            |        |           |         |
```

## 🔧 Setup Instructions

### Step 1: Create Headers
1. Open your Google Sheet
2. Add the column headers in Row 1 exactly as shown above
3. **Important**: The `cost` column (Column J) must be present for cost tracking to work

### Step 2: Add Your Data
1. Fill in `scene_id` (unique for each row)
2. Fill in `prompt` (your AI generation requests)
3. Optionally set `variants` (defaults to 1 if empty)
4. Leave other columns empty - they'll be auto-populated

### Step 3: Share with Service Account
1. Share your sheet with: `orchestrator-sa@solid-study-467023-i3.iam.gserviceaccount.com`
2. Give **Editor** permissions
3. Copy your Sheet ID from the URL

## 🎯 Status Filter Options

When calling the API, you can filter which rows to process:

- **`"status": "all"`** - Process ALL rows (default)
- **`"status": "pending"`** - Only empty or `pending` rows
- **`"status": "completed"`** - Only `completed` rows
- **`"status": "error"`** - Only `error` rows  
- **`"status": "running"`** - Only `running` rows

## 🌐 API Usage Example

```bash
curl -X POST http://localhost:9090/batch/sheets \
  -H "Content-Type: application/json" \
  -H "x-sheet-id: YOUR_SHEET_ID" \
  -d '{
    "runMode": "live",
    "rowFilter": {
      "status": "pending",
      "limit": 10
    }
  }'
```

## 📊 Expected Output

After processing, your sheet will be updated with:

- **nano_img_1/2/3**: Direct links to generated images (7-day expiry)
- **status_img**: `completed`, `error`, or `running`
- **job_id**: Batch processing identifier
- **error_msg**: Error details if generation failed
- **cost**: Actual cost for the row (e.g., `$0.0040`)

## ⚡ Pro Tips

1. **Cost Tracking**: Monitor spending with the new cost column
2. **Batch Processing**: Set reasonable limits (max 100 rows per batch)
3. **Status Management**: Use status filters to avoid re-processing
4. **Error Recovery**: Check `error_msg` column if generation fails
5. **URL Expiry**: Image URLs expire after 7 days - download if needed long-term

---

**Version**: 1.1.0 (Cost Tracking Update)  
**Updated**: September 6, 2025