# Google Sheet Template for AI Asset Generation

## Required Columns

Your Google Sheet must have the following columns in the first row (headers):

| Column Name | Type | Required | Description |
|-------------|------|----------|-------------|
| `scene_id` | String | Yes | Unique identifier for each row (e.g., "scene-001", "product-123") |
| `prompt` | String | Yes | The text prompt for image generation |
| `variants` | Number | No | Number of image variants to generate (1-3, defaults to 1) |
| `status_img` | String | No | Status of generation: "pending", "running", "completed", "error" |
| `nano_img_1` | String | No | URL of first generated image (filled by system) |
| `nano_img_2` | String | No | URL of second generated image (filled by system) |
| `nano_img_3` | String | No | URL of third generated image (filled by system) |
| `job_id` | String | No | Batch job ID (filled by system) |
| `error_msg` | String | No | Error message if generation fails (filled by system) |

## Example Sheet Structure

```
| scene_id | prompt | variants | status_img | nano_img_1 | nano_img_2 | nano_img_3 | job_id | error_msg |
|----------|--------|----------|------------|------------|------------|------------|--------|-----------|
| scene-001 | A beautiful sunset over mountains with golden light | 2 | pending | | | | | |
| scene-002 | Modern office workspace with plants and natural lighting | 1 | pending | | | | | |
| scene-003 | Abstract geometric patterns in blue and purple | 3 | pending | | | | | |
```

## How to Set Up Your Sheet

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1O6HUXqPHfxRNK24LV3RxsqZtvgVuttfJ6Q2JznJV7kM/edit

2. In the first row, add these column headers exactly as shown:
   - A1: `scene_id`
   - B1: `prompt`
   - C1: `variants`
   - D1: `status_img`
   - E1: `nano_img_1`
   - F1: `nano_img_2`
   - G1: `nano_img_3`
   - H1: `job_id`
   - I1: `error_msg`

3. Starting from row 2, add your data:
   - Each row represents one image generation request
   - `scene_id` must be unique for each row
   - `prompt` is the description of the image you want
   - `variants` is optional (1-3), defaults to 1 if not specified

4. Save your sheet

## Permissions

Make sure your Google Sheet has the following permissions:
- The service account `orchestrator-sa@solid-study-467023-i3.iam.gserviceaccount.com` needs Editor access
- Or make the sheet publicly editable (less secure)

## API Usage

Once your sheet is set up, the API will:
1. Read rows from your sheet
2. Generate images based on the prompts
3. Update the sheet with generated image URLs and status

### To process your sheet:
```bash
curl -X POST http://localhost:9090/batch/sheets \
  -H "Content-Type: application/json" \
  -H "x-sheet-id: 1O6HUXqPHfxRNK24LV3RxsqZtvgVuttfJ6Q2JznJV7kM" \
  -d '{
    "runMode": "dry_run"
  }'
```