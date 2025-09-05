/**
 * AI Asset Generation Platform - Apps Script UI
 * Phase 1: Image-only generation with future-proofing for video
 * 
 * IMPORTANT: Keep this file ultra-thin to stay under Apps Script quotas
 * - Single POST per menu action (no loops, no retries)
 * - Minimal processing (validate + send to backend)
 * - All business logic in Cloud Run service
 */

// Configuration - Update these values for your deployment
const CONFIG = {
  API_BASE_URL: 'https://your-cloud-run-service-url',  // Update this
  SHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId(),
  MAX_ROWS_PER_BATCH: 10,
  MAX_VARIANTS_PER_ROW: 3,
};

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 AI Generation')
    .addItem('📸 Generate Images (Dry-Run)', 'generateImagesDryRun')
    .addItem('🎬 Generate Images (Live)', 'generateImagesLive')
    .addSeparator()
    .addItem('🎥 Generate Video (Phase 2)', 'generateVideosPlaceholder')
    .addSeparator() 
    .addItem('📊 Check Status', 'checkJobStatus')
    .addItem('❓ Help', 'showHelp')
    .addToUi();
}

/**
 * Generate images in dry-run mode (show cost, no API calls)
 */
function generateImagesDryRun() {
  try {
    const selectedRows = getSelectedRows();
    if (!selectedRows.valid) {
      showError(selectedRows.error);
      return;
    }

    const { rows, totalVariants } = selectedRows;
    const estimatedCost = totalVariants * 0.002; // $0.002 per image
    
    const message = `🎨 Image Generation (Dry Run)\n\n` +
      `Rows selected: ${rows.length}\n` +
      `Total images: ${totalVariants}\n` +
      `Estimated cost: $${estimatedCost.toFixed(3)}\n\n` +
      `This is a dry run - no images will be generated.\n` +
      `Click "Generate Images (Live)" to proceed with actual generation.`;
    
    showInfo(message);
  } catch (error) {
    showError(`Dry run failed: ${error.message}`);
  }
}

/**
 * Generate images in live mode (actual API call)
 */
function generateImagesLive() {
  try {
    const selectedRows = getSelectedRows();
    if (!selectedRows.valid) {
      showError(selectedRows.error);
      return;
    }

    const { rows, totalVariants } = selectedRows;
    const estimatedCost = totalVariants * 0.002;
    
    // Confirmation dialog with cost
    const confirmMessage = `🎬 Generate Images (Live)\n\n` +
      `Rows: ${rows.length} | Images: ${totalVariants} | Cost: $${estimatedCost.toFixed(3)}\n\n` +
      `Type "CONFIRM" to proceed with live generation:`;
    
    const userInput = Browser.inputBox('Confirm Image Generation', confirmMessage, Browser.Buttons.OK_CANCEL);
    
    if (userInput !== 'CONFIRM') {
      showInfo('Image generation cancelled.');
      return;
    }

    // Prepare API request
    const payload = {
      items: rows.map(row => ({
        scene_id: row.scene_id,
        prompt: row.prompt,
        ref_pack_public_url: row.ref_pack_public_url,
        variants: parseInt(row.variants) || 3,
      })),
      runMode: 'live'
    };

    // Single POST to backend (stay under 6-minute quota)
    const response = callAPI('POST', '/batch/images', payload);
    
    if (response.success) {
      showInfo(`✅ Image generation started!\n\nBatch ID: ${response.data.batchId}\nJobs queued: ${response.data.accepted}\n\nImages will appear in the sheet when ready.`);
    } else {
      showError(`❌ Generation failed: ${response.error}`);
    }
    
  } catch (error) {
    showError(`Live generation failed: ${error.message}`);
  }
}

/**
 * Placeholder for video generation (Phase 2)
 */
function generateVideosPlaceholder() {
  const message = `🎥 Video Generation\n\n` +
    `Video generation will be available in Phase 2.\n\n` +
    `Expected features:\n` +
    `• Convert approved images to 8-second videos\n` +
    `• Multiple aspect ratios (16:9, 9:16)\n` +
    `• Cost estimation and manual approval\n\n` +
    `Stay tuned for updates!`;
  
  showInfo(message);
}

/**
 * Check status of running jobs
 */
function checkJobStatus() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      showInfo('No jobs found in sheet.');
      return;
    }
    
    const [headers, ...rows] = values;
    const jobIdIndex = headers.indexOf('job_id');
    const statusIndex = headers.indexOf('status_img');
    
    if (jobIdIndex === -1) {
      showError('job_id column not found in sheet.');
      return;
    }
    
    const runningJobs = rows.filter(row => 
      row[jobIdIndex] && ['queued', 'running'].includes(row[statusIndex])
    ).length;
    
    const completedJobs = rows.filter(row => 
      row[jobIdIndex] && row[statusIndex] === 'awaiting_review'
    ).length;
    
    const message = `📊 Job Status Summary\n\n` +
      `Running jobs: ${runningJobs}\n` +
      `Completed jobs: ${completedJobs}\n\n` +
      `Jobs will update automatically in the sheet.`;
    
    showInfo(message);
    
  } catch (error) {
    showError(`Status check failed: ${error.message}`);
  }
}

/**
 * Show help information
 */
function showHelp() {
  const message = `🤖 AI Asset Generation Help\n\n` +
    `WORKFLOW:\n` +
    `1. Fill in scene_id, prompt, ref_pack_public_url\n` +
    `2. Select rows to process\n` +
    `3. Use "Generate Images (Dry-Run)" to check cost\n` +
    `4. Use "Generate Images (Live)" to create images\n` +
    `5. Review thumbnails and set approved_image_url\n\n` +
    `LIMITS:\n` +
    `• Max ${CONFIG.MAX_ROWS_PER_BATCH} rows per batch\n` +
    `• Max ${CONFIG.MAX_VARIANTS_PER_ROW} variants per row\n` +
    `• 10-minute cooldown between batches\n\n` +
    `Need help? Check the RUNBOOK.md documentation.`;
  
  showInfo(message);
}

/**
 * Get selected rows with validation
 */
function getSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getActiveRange();
  const allValues = sheet.getDataRange().getValues();
  
  if (allValues.length <= 1) {
    return { valid: false, error: 'Sheet appears to be empty or missing headers.' };
  }
  
  const [headers, ...allRows] = allValues;
  const requiredColumns = ['scene_id', 'prompt', 'ref_pack_public_url'];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    return { valid: false, error: `Missing required columns: ${missingColumns.join(', ')}` };
  }
  
  // Get selected row indices (1-based, excluding header)
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  const selectedRowIndices = [];
  
  for (let i = startRow; i < startRow + numRows; i++) {
    if (i > 1) { // Skip header row
      selectedRowIndices.push(i - 2); // Convert to 0-based index for allRows
    }
  }
  
  if (selectedRowIndices.length === 0) {
    return { valid: false, error: 'No data rows selected. Click on rows below the header.' };
  }
  
  if (selectedRowIndices.length > CONFIG.MAX_ROWS_PER_BATCH) {
    return { valid: false, error: `Too many rows selected. Maximum is ${CONFIG.MAX_ROWS_PER_BATCH}.` };
  }
  
  // Convert selected rows to objects
  const rows = selectedRowIndices.map(index => {
    const row = allRows[index];
    const rowObj = {};
    headers.forEach((header, i) => {
      rowObj[header] = row[i] || '';
    });
    return rowObj;
  });
  
  // Validation
  const invalidRows = rows.filter(row => 
    !row.scene_id || !row.prompt || !row.ref_pack_public_url
  );
  
  if (invalidRows.length > 0) {
    return { valid: false, error: `${invalidRows.length} rows missing required data (scene_id, prompt, ref_pack_public_url).` };
  }
  
  // Calculate total variants
  const totalVariants = rows.reduce((sum, row) => {
    const variants = parseInt(row.variants) || 3;
    return sum + Math.min(variants, CONFIG.MAX_VARIANTS_PER_ROW);
  }, 0);
  
  return { valid: true, rows, totalVariants };
}

/**
 * Make API call to backend service
 */
function callAPI(method, endpoint, payload) {
  try {
    const response = UrlFetchApp.fetch(CONFIG.API_BASE_URL + endpoint, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Platform-Apps-Script/1.0',
      },
      payload: payload ? JSON.stringify(payload) : undefined,
      muteHttpExceptions: true,
    });
    
    const responseData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() >= 400) {
      return { success: false, error: responseData.message || 'API request failed' };
    }
    
    return { success: true, data: responseData };
  } catch (error) {
    return { success: false, error: `Network error: ${error.message}` };
  }
}

/**
 * Utility functions for user feedback
 */
function showInfo(message) {
  SpreadsheetApp.getUi().alert('ℹ️ Information', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function showError(message) {
  SpreadsheetApp.getUi().alert('❌ Error', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Install trigger for onOpen (run this once manually)
 */
function installTrigger() {
  ScriptApp.newTrigger('onOpen')
    .create();
}