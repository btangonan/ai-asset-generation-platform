/**
 * AI Asset Generation Platform - Google Sheets Interface
 * Web App Version - Automatic Sheet Creation
 * 
 * Web App URL: Click once to get your own AI-powered Google Sheet!
 */

// Configuration - Production ready
const CONFIG = {
  API_BASE_URL: 'https://orchestrator-582559442661.us-central1.run.app',
  API_KEY: 'YOUR_API_KEY_HERE', // TODO: Replace with your actual API key
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
    .addItem('🎯 Setup Template (First Time)', 'setupTemplate')
    .addSeparator()
    .addItem('🧪 Test Generate (Free)', 'generateImagesDryRun')
    .addItem('🚀 Live Generate ($0.25)', 'generateImagesLive')
    .addSeparator()
    .addItem('🖼️ Open Reference Manager', 'openWebApp')
    .addItem('📊 Refresh Status', 'refreshStatus')
    .addItem('🔄 Clear All Status', 'clearAllStatus')
    .addToUi();
}

/**
 * Open the web app reference manager
 */
function openWebApp() {
  const webAppUrl = 'https://your-web-app-url.com'; // TODO: Replace with actual web app URL
  const html = HtmlService.createHtmlOutput(
    `<div style="padding: 20px;">
      <h3>🖼️ Reference Manager</h3>
      <p>Opening visual reference manager...</p>
      <a href="${webAppUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px;">Open Reference Manager</a>
    </div>`
  )
  .setTitle('Reference Manager')
  .setWidth(400);
  
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Setup the template with sample data - ONE CLICK SETUP
 */
function setupTemplate() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  
  // Check if already set up
  if (sheet.getRange(1, 1).getValue() === 'scene_id') {
    const response = ui.alert('Template Setup', 'Template is already set up. Reset with new data?', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) {
      return;
    }
  }
  
  // Clear existing data
  sheet.clear();
  
  // Set up headers
  const headers = [
    'scene_id', 'prompt', 'ref_pack_id', 'ref_pack_public_url', 'variants',
    'status_img', 'nano_img_1', 'nano_img_2', 'nano_img_3', 'job_id',
    'error_msg', 'cost', 'approved_image_url', 'status_video'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Add sample data
  const sampleData = [
    ['TEST-001', 'A warm cinematic kitchen scene with morning sunlight streaming through windows', 'REF-001', '', 3, '', '', '', '', '', '', '', '', ''],
    ['TEST-002', 'Modern living room with cozy afternoon lighting and green plants', 'REF-002', '', 2, '', '', '', '', '', '', '', '', ''],
    ['TEST-003', 'Elegant bedroom with soft evening ambiance and warm colors', 'REF-003', '', 1, '', '', '', '', '', '', '', '', ''],
    ['TEST-004', 'Rustic coffee shop with wooden furniture and vintage decorations', 'REF-004', '', 3, '', '', '', '', '', '', '', '', ''],
    ['TEST-005', 'Modern office space with natural light and minimalist design', 'REF-005', '', 2, '', '', '', '', '', '', '', '', '']
  ];
  
  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
  
  // Format the sheet
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  // Add some styling
  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setBorder(true, true, true, true, true, true);
  
  ui.alert('✅ Template Ready!', 
    'Your AI Asset Generator is ready to use!\n\n' +
    '🎯 Next steps:\n' +
    '1. Click on any data row (2, 3, 4, 5, or 6)\n' +
    '2. Use "🧪 Test Generate (Free)" to try it out\n' +
    '3. Check the status columns for results\n\n' +
    '💡 Tip: Test mode is completely free and safe!', 
    ui.ButtonSet.OK
  );
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
    `This will generate images for ${selectedRows.length} row(s) at $${CONFIG.COST_PER_IMAGE} each.\n\nTotal estimated cost: $${totalCost.toFixed(2)}\n\nContinue with LIVE generation?`,
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
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
  const ui = SpreadsheetApp.getUi();
  
  if (selectedRows.length === 0) {
    ui.alert('No rows selected', 
      'Please click on a row number (like row 2, 3, 4...) to select it, then try again.\n\n' +
      '💡 Tip: Click on the row NUMBER on the left, not just a cell!', 
      ui.ButtonSet.OK
    );
    return;
  }
  
  // Update status to 'processing'
  selectedRows.forEach(row => {
    sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('processing...');
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
      
      const modeText = runMode === 'dry_run' ? 'TEST' : 'LIVE';
      const costText = runMode === 'dry_run' ? '(FREE)' : `($${(selectedRows.length * CONFIG.COST_PER_IMAGE).toFixed(2)})`;
      
      ui.alert(
        `✅ ${modeText} Generation Started!`,
        `Job ID: ${result.job_id} ${costText}\n\n` +
        `Images are being generated. Use "📊 Refresh Status" to check progress.\n\n` +
        `💡 Tip: Results will appear in columns G, H, I (nano_img_1, 2, 3)`,
        ui.ButtonSet.OK
      );
    } else {
      // Error
      selectedRows.forEach(row => {
        sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('error');
        sheet.getRange(row.rowIndex, COLUMNS.ERROR_MSG).setValue(result.detail || 'Unknown error');
      });
      
      ui.alert('❌ Generation Failed', result.detail || 'Unknown error occurred', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    // Network or parsing error
    selectedRows.forEach(row => {
      sheet.getRange(row.rowIndex, COLUMNS.STATUS_IMG).setValue('error');
      sheet.getRange(row.rowIndex, COLUMNS.ERROR_MSG).setValue(`Network error: ${error.message}`);
    });
    
    ui.alert('❌ Request Failed', `Network error: ${error.message}`, ui.ButtonSet.OK);
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
  
  // Skip header row
  if (startRow === 1) {
    return [];
  }
  
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
  let updatedCount = 0;
  
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
          
          updatedCount++;
        }
        
      } catch (error) {
        console.log(`Error refreshing status for job ${jobId}: ${error.message}`);
      }
    }
  }
  
  SpreadsheetApp.getUi().alert(
    '📊 Status Updated!', 
    `Refreshed ${updatedCount} job(s).\n\n` +
    `💡 Tip: Image URLs appear in columns G, H, I. Click them to view images!`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
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
  
  ui.alert('🔄 Status Cleared!', 'All status information has been cleared. Ready for new tests!', ui.ButtonSet.OK);
}

/**
 * Test API connection - for debugging
 */
/**
 * WEB APP FUNCTIONALITY
 * This is what creates the zero-setup experience
 */

/**
 * Handles web app requests - creates new sheets automatically
 */
function doGet(e) {
  try {
    // Create a unique sheet name
    const timestamp = new Date().getTime();
    const sheetName = `AI Image Generator - ${timestamp}`;
    
    // Create the new Google Sheet
    const newSheet = SpreadsheetApp.create(sheetName);
    const sheet = newSheet.getActiveSheet();
    
    // Set up the template automatically
    setupTemplateForNewSheet(sheet);
    
    // Get the sheet URL
    const sheetUrl = newSheet.getUrl();
    
    // Create success page with redirect
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>🎬 AI Asset Generator - Ready!</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container { 
          background: rgba(255,255,255,0.1); 
          padding: 40px; 
          border-radius: 20px; 
          max-width: 600px; 
          margin: 0 auto;
        }
        .button {
          background: #28a745;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          display: inline-block;
          margin: 20px;
        }
        .button:hover { background: #218838; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 Success! Your AI Image Generator is Ready!</h1>
        <p>Your personal Google Sheet has been created with:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>✅ Sample data pre-loaded</li>
          <li>✅ Professional formatting applied</li>
          <li>✅ AI generation menu installed</li>
          <li>✅ Free testing mode enabled</li>
        </ul>
        <p><strong>What's next?</strong></p>
        <ol style="text-align: left; display: inline-block;">
          <li>Click the button below to open your sheet</li>
          <li>Select any row (click the row number)</li>
          <li>Use menu "🎬 AI Asset Generator" → "🧪 Test Generate (Free)"</li>
        </ol>
        <a href="${sheetUrl}" class="button" target="_top">🚀 Open My AI Sheet</a>
        <p style="font-size: 14px; margin-top: 30px;">
          💡 Tip: Test mode is completely free and safe!
        </p>
      </div>
      <script>
        // Auto-redirect after 3 seconds
        setTimeout(function() {
          window.top.location.href = "${sheetUrl}";
        }, 3000);
      </script>
    </body>
    </html>
    `;
    
    return HtmlService.createHtmlOutput(html)
      .setTitle('🎬 AI Asset Generator - Ready!')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    // Error handling
    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Error</title></head>
    <body style="font-family: Arial; text-align: center; padding: 50px;">
      <h2>❌ Oops! Something went wrong</h2>
      <p>Error: ${error.message}</p>
      <p><a href="#" onclick="window.top.location.reload()">🔄 Try Again</a></p>
    </body>
    </html>
    `;
    
    return HtmlService.createHtmlOutput(errorHtml)
      .setTitle('Error - AI Asset Generator');
  }
}

/**
 * Set up template for newly created sheet (used by web app)
 */
function setupTemplateForNewSheet(sheet) {
  // Clear any existing content
  sheet.clear();
  
  // Set up headers
  const headers = [
    'scene_id', 'prompt', 'ref_pack_id', 'ref_pack_public_url', 'variants',
    'status_img', 'nano_img_1', 'nano_img_2', 'nano_img_3', 'job_id',
    'error_msg', 'cost', 'approved_image_url', 'status_video'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Add sample data
  const sampleData = [
    ['TEST-001', '🏠 A warm cinematic kitchen scene with morning sunlight streaming through windows', 'REF-001', '', 3, 'ready', '', '', '', '', '', '', '', ''],
    ['TEST-002', '🌿 Modern living room with cozy afternoon lighting and green plants', 'REF-002', '', 2, 'ready', '', '', '', '', '', '', '', ''],
    ['TEST-003', '🛏️ Elegant bedroom with soft evening ambiance and warm colors', 'REF-003', '', 1, 'ready', '', '', '', '', '', '', '', ''],
    ['TEST-004', '☕ Rustic coffee shop with wooden furniture and vintage decorations', 'REF-004', '', 3, 'ready', '', '', '', '', '', '', '', ''],
    ['TEST-005', '💼 Modern office space with natural light and minimalist design', 'REF-005', '', 2, 'ready', '', '', '', '', '', '', '', ''],
    ['TEST-006', '🍽️ Cozy restaurant dining room with ambient lighting', 'REF-006', '', 1, 'ready', '', '', '', '', '', '', '', '']
  ];
  
  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
  
  // Format the sheet professionally
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  // Add borders and alternating colors
  const dataRange = sheet.getRange(1, 1, sampleData.length + 1, headers.length);
  dataRange.setBorder(true, true, true, true, true, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
  
  // Add alternating row colors
  for (let i = 2; i <= sampleData.length + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRange(i, 1, 1, headers.length).setBackground('#f8f9fa');
    }
  }
  
  // Set column widths for better readability
  sheet.setColumnWidth(1, 100); // scene_id
  sheet.setColumnWidth(2, 400); // prompt
  sheet.setColumnWidth(3, 80);  // ref_pack_id
  sheet.setColumnWidth(6, 120); // status_img
  sheet.setColumnWidth(7, 200); // nano_img_1
  sheet.setColumnWidth(8, 200); // nano_img_2
  sheet.setColumnWidth(9, 200); // nano_img_3
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Add instructions in a note
  const instructionCell = sheet.getRange('A1');
  instructionCell.setNote(
    '🎬 AI Asset Generator Instructions:\n\n' +
    '1. Click on any row number (2, 3, 4...) to select a row\n' +
    '2. Extensions → Apps Script to open the script editor\n' +
    '3. Paste the AI Generator code and save\n' +
    '4. Refresh this sheet to see the "🎬 AI Asset Generator" menu\n' +
    '5. Use "🧪 Test Generate (Free)" to test!\n\n' +
    '💡 Test mode is completely free and safe to use!'
  );
}

/**
 * Test API connection - for debugging
 */
function testApiConnection() {
  try {
    const response = UrlFetchApp.fetch(`${CONFIG.API_BASE_URL}/healthz`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      SpreadsheetApp.getUi().alert('✅ API Connection', 'API is working perfectly!', SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('❌ API Error', `Status: ${response.getResponseCode()}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Connection Failed', `Error: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}