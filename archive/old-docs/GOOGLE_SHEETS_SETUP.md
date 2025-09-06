# Google Sheets End-to-End Testing Setup

## Step 1: Create the Google Sheet

1. **Go to Google Sheets**: https://sheets.google.com
2. **Create new spreadsheet** named "AI Asset Generator - Test"
3. **Import the CSV data**:
   - File → Import
   - Upload → Select `/test-sheet-data.csv` from this project
   - Import location: "Replace spreadsheet"
   - Separator type: "Comma"
   - Click "Import data"

## Step 2: Set Up Apps Script

1. **Open Apps Script**: Extensions → Apps Script
2. **Replace Code.gs** with our production-ready code
3. **Set up configuration**:

```javascript
// Configuration - UPDATE THESE VALUES
const CONFIG = {
  API_BASE_URL: 'https://orchestrator-582559442661.us-central1.run.app',
  API_KEY: 'aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc',
  SHEET_NAME: 'Sheet1',
  COST_PER_IMAGE: 0.25,
  RATES_VEO_3: 0.50,
  RATES_VEO_3_FAST: 0.30
};
```

## Step 3: Install Apps Script Code

**Replace the contents of `Code.gs` with:**

```javascript
/**
 * AI Asset Generation Platform - Google Sheets Interface
 * Production version for Cloud Run deployment
 */

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://orchestrator-582559442661.us-central1.run.app',
  API_KEY: 'aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc',
  SHEET_NAME: 'Sheet1',
  COST_PER_IMAGE: 0.25,
  RATES_VEO_3: 0.50,
  RATES_VEO_3_FAST: 0.30
};

// Column mappings
const COLUMNS = {
  SCENE_ID: 1,
  PROMPT: 2,
  REF_PACK_ID: 3,
  REF_PACK_PUBLIC_URL: 4,
  VARIANTS: 5,
  STATUS_IMG: 6,
  NANO_IMG_1: 7,
  NANO_IMG_2: 8,
  NANO_IMG_3: 9,
  JOB_ID: 10,
  ERROR_MSG: 11,
  COST: 12,
  APPROVED_IMAGE_URL: 13,
  STATUS_VIDEO: 14
};

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎬 AI Asset Generator')
    .addItem('🖼️ Generate Images (Dry Run)', 'generateImagesDryRun')
    .addItem('🖼️ Generate Images (LIVE)', 'generateImagesLive')
    .addSeparator()
    .addItem('🎥 Generate Videos (Preview)', 'generateVideosPreview')
    .addItem('🎥 Generate Videos (LIVE)', 'generateVideosLive')
    .addSeparator()
    .addItem('📊 Refresh Status', 'refreshStatus')
    .addItem('🔄 Clear All Status', 'clearAllStatus')
    .addToUi();
}

/**
 * Generate images in dry-run mode (no cost)
 */
function generateImagesDryRun() {
  generateImages('dry_run');
}

/**
 * Generate images in live mode (costs money)
 */
function generateImagesLive() {
  const ui = SpreadsheetApp.getUi();
  const selectedRows = getSelectedImageRows();
  
  if (selectedRows.length === 0) {
    ui.alert('No rows selected', 'Please select at least one row to generate images for.', ui.ButtonSet.OK);
    return;
  }
  
  const totalCost = selectedRows.length * CONFIG.COST_PER_IMAGE;
  const response = ui.alert(
    'Live Image Generation',
    `This will generate images for ${selectedRows.length} row(s) at $${CONFIG.COST_PER_IMAGE} each.\n\nTotal estimated cost: $${totalCost.toFixed(2)}\n\nType "${selectedRows.length}" to confirm:`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response !== ui.Button.OK) {
    return;
  }
  
  const userInput = ui.prompt('Confirm Live Generation', `Type "${selectedRows.length}" to confirm:`, ui.ButtonSet.OK_CANCEL);
  if (userInput.getSelectedButton() !== ui.Button.OK || userInput.getResponseText() !== selectedRows.length.toString()) {
    ui.alert('Generation cancelled', 'Confirmation failed. No images will be generated.', ui.ButtonSet.OK);
    return;
  }
  
  generateImages('live');
}

/**
 * Core image generation function
 */
function generateImages(runMode) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const selectedRows = getSelectedImageRows();
  
  if (selectedRows.length === 0) {
    SpreadsheetApp.getUi().alert('No rows selected', 'Please select at least one row to generate images for.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  // Update status to 'processing'
  selectedRows.forEach(row => {
    sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('processing');
  });
  
  // Build request payload
  const payload = {
    items: selectedRows.map(row => ({
      scene_id: row.scene_id,
      prompt: row.prompt,
      ref_pack_public_url: row.ref_pack_public_url || null,
      variants: parseInt(row.variants) || 1
    })),
    runMode: runMode
  };
  
  try {
    const response = UrlFetchApp.fetch(`${CONFIG.API_BASE_URL}/batch/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY
      },
      payload: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 202) {
      // Success - update with job ID
      selectedRows.forEach(row => {
        sheet.getRange(row.rowIndex, COLUMNS.JOB_ID).setValue(result.job_id);
        sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('queued');
      });
      
      SpreadsheetApp.getUi().alert(
        'Images Queued Successfully',
        `Job ID: ${result.job_id}\n\nImages are being generated. Use "Refresh Status" to check progress.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      // Error
      selectedRows.forEach(row => {
        sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('error');
        sheet.getRange(row.rowIndex, COLUMNS.ERROR_MSG).setValue(result.detail || 'Unknown error');
      });
      
      SpreadsheetApp.getUi().alert('Generation Failed', result.detail || 'Unknown error occurred', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    
  } catch (error) {
    // Network or parsing error
    selectedRows.forEach(row => {
      sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('error');
      sheet.getRange(row.rowIndex, COLUMNS.ERROR_MSG).setValue(`Network error: ${error.message}`);
    });
    
    SpreadsheetApp.getUi().alert('Request Failed', `Network error: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Get selected rows with image data
 */
function getSelectedImageRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const selection = sheet.getSelection();
  const range = selection.getActiveRange();
  
  if (!range) {
    return [];
  }
  
  const startRow = range.getRow();
  const numRows = range.getNumRows();
  const data = sheet.getRange(startRow, 1, numRows, COLUMNS.STATUS_VIDEO).getValues();
  
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[COLUMNS.SCENE_ID - 1] && row[COLUMNS.PROMPT - 1]) { // Valid row
      rows.push({
        rowIndex: startRow + i,
        scene_id: row[COLUMNS.SCENE_ID - 1],
        prompt: row[COLUMNS.PROMPT - 1],
        ref_pack_public_url: row[COLUMNS.REF_PACK_PUBLIC_URL - 1],
        variants: row[COLUMNS.VARIANTS - 1]
      });
    }
  }
  
  return rows;
}

/**
 * Refresh status for all jobs
 */
function refreshStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Skip header row
    const row = data[i];
    const jobId = row[COLUMNS.JOB_ID - 1];
    
    if (jobId && jobId !== '') {
      try {
        const response = UrlFetchApp.fetch(`${CONFIG.API_BASE_URL}/status/${jobId}`, {
          method: 'GET',
          headers: {
            'x-api-key': CONFIG.API_KEY
          }
        });
        
        const result = JSON.parse(response.getContentText());
        
        if (response.getResponseCode() === 200) {
          // Update status and results
          sheet.getRange(i + 1, COLUMNS.STATUS_IMG).setValue(result.status);
          
          if (result.results) {
            // Update image URLs
            if (result.results.nano_img_1) sheet.getRange(i + 1, COLUMNS.NANO_IMG_1).setValue(result.results.nano_img_1);
            if (result.results.nano_img_2) sheet.getRange(i + 1, COLUMNS.NANO_IMG_2).setValue(result.results.nano_img_2);
            if (result.results.nano_img_3) sheet.getRange(i + 1, COLUMNS.NANO_IMG_3).setValue(result.results.nano_img_3);
          }
          
          if (result.cost) {
            sheet.getRange(i + 1, COLUMNS.COST).setValue(result.cost);
          }
          
          if (result.error) {
            sheet.getRange(i + 1, COLUMNS.ERROR_MSG).setValue(result.error);
          }
        }
        
      } catch (error) {
        console.log(`Error refreshing status for job ${jobId}: ${error.message}`);
      }
    }
  }
  
  SpreadsheetApp.getUi().alert('Status Refreshed', 'All job statuses have been updated.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Clear all status and results
 */
function clearAllStatus() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Status',
    'This will clear all job IDs, status, images, and errors. Are you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    // Clear status columns for all rows
    sheet.getRange(2, COLUMNS.STATUS_IMG, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COLUMNS.NANO_IMG_1, lastRow - 1, 3).clearContent(); // Images 1-3
    sheet.getRange(2, COLUMNS.JOB_ID, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COLUMNS.ERROR_MSG, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COLUMNS.COST, lastRow - 1, 1).clearContent();
    sheet.getRange(2, COLUMNS.APPROVED_IMAGE_URL, lastRow - 1, 1).clearContent();
  }
  
  ui.alert('Status Cleared', 'All status information has been cleared.', ui.ButtonSet.OK);
}

/**
 * Video generation placeholder functions
 */
function generateVideosPreview() {
  SpreadsheetApp.getUi().alert('Coming Soon', 'Video generation will be available in Phase 2.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateVideosLive() {
  SpreadsheetApp.getUi().alert('Coming Soon', 'Video generation will be available in Phase 2.', SpreadsheetApp.getUi().ButtonSet.OK);
}
```

## Step 4: Test the Integration

1. **Save and authorize** the Apps Script (click Save button)
2. **Authorize permissions** when prompted
3. **Go back to your Sheet**
4. **Refresh the page** - you should see the "🎬 AI Asset Generator" menu
5. **Select a few rows** (click on row numbers 2-4)
6. **Test dry run**: Menu → Generate Images (Dry Run)
7. **Check the results** in the sheet

## Step 5: Test Live Generation (Optional)

**WARNING**: This will cost real money ($0.25 per image)

1. **Select 1 row** only for testing
2. **Menu → Generate Images (LIVE)**
3. **Confirm the cost** and type "1" when prompted
4. **Wait for completion** and use "Refresh Status" to check progress

## Step 6: Verify End-to-End Workflow

✅ **Expected Results**:
- Status should change from "queued" → "processing" → "completed"
- Image URLs should appear in `nano_img_1`, `nano_img_2`, `nano_img_3` columns
- Job ID should be populated
- Cost should be calculated
- No error messages

## Troubleshooting

### If menu doesn't appear:
1. Refresh the Google Sheet page
2. Check that `onOpen()` function exists in Apps Script
3. Make sure you saved the script

### If API calls fail:
1. Check the Cloud Run service is running: https://orchestrator-582559442661.us-central1.run.app/healthz
2. Verify API key in CONFIG section
3. Check browser console in Apps Script for errors

### If images don't generate:
1. Check error messages in the `error_msg` column
2. Verify GCS bucket permissions
3. Use "Refresh Status" to get latest job status

## Alternative Setup Methods

Since you asked about other ways to generate this, here are programmatic alternatives:

### Method 1: Google Sheets API (Python)
```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Create sheet and populate with test data programmatically
service = build('sheets', 'v4', credentials=creds)
# ... implementation details
```

### Method 2: Direct API Call
```bash
# Create template via API
curl -X POST https://orchestrator-582559442661.us-central1.run.app/batch/sheets \
  -H "x-api-key: aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc" \
  -H "Content-Type: application/json" \
  -d '{"action": "create_template", "rows": 3}'
```

### Method 3: Google Apps Script Generator
Add this function to generate test data automatically:

```javascript
function generateTestData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const testData = [
    ['TEST-001', 'A warm cinematic kitchen scene', 'REF-001', '', 3, 'ready', '', '', '', '', '', '', '', 'ready_to_queue'],
    ['TEST-002', 'Modern living room with plants', 'REF-002', '', 2, 'ready', '', '', '', '', '', '', '', 'ready_to_queue'],
    ['TEST-003', 'Elegant bedroom with ambiance', 'REF-003', '', 1, 'ready', '', '', '', '', '', '', '', 'ready_to_queue']
  ];
  
  sheet.getRange(2, 1, testData.length, testData[0].length).setValues(testData);
}
```

The CSV method I provided is the simplest for initial testing, but any of these programmatic approaches can be used for more dynamic data generation.