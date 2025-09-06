/**
 * AI Asset Generation Platform - Google Apps Script UI
 * 
 * This script provides a Google Sheets UI for the AI Asset Generation Platform.
 * It handles menu creation, user interactions, and API communication with the backend.
 * 
 * Features:
 * - Custom menu with image/video generation options
 * - Single POST per operation (quota-conscious)
 * - Cost estimation and confirmation dialogs
 * - Sidebar UI for thumbnail approval
 * - Error handling with user-friendly messages
 * 
 * Architecture: UI-only - no business logic, delegates all processing to backend
 */

// Configuration constants
const CONFIG_SHEET = 'CONFIG';
const API_BASE_URL_CELL = 'B2';  // Named range: CONFIG!B2
const MAX_ROWS_CELL = 'B3';      // Named range: CONFIG!B3
const DEFAULT_MAX_ROWS = 10;
const COST_PER_IMAGE = 0.002;    // $0.002 per image (matches backend)

// Required sheet headers (matches backend contract)
const REQUIRED_HEADERS = ['scene_id', 'prompt', 'variants', 'status_img', 'nano_img_1', 'nano_img_2', 'nano_img_3', 'job_id', 'error_msg', 'cost'];
const IMAGE_HEADERS = ['nano_img_1', 'nano_img_2', 'nano_img_3'];

/**
 * Initialize the custom menu when the spreadsheet opens
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('AI')
      .addItem('Generate Images (Dry-Run)', 'generateImagesDryRun')
      .addItem('Generate Images (Live)', 'generateImagesLive')
      .addSeparator()
      .addItem('Generate Video (Veo)', 'generateVideo')
      .addSeparator()
      .addItem('Open Sidebar', 'openSidebar')
      .addToUi();
  } catch (error) {
    console.error('Failed to create menu:', error);
  }
}

/**
 * Generate images in dry-run mode (no cost, preview only)
 */
function generateImagesDryRun() {
  generateImages_('dry_run');
}

/**
 * Generate images in live mode (actual generation with cost)
 */
function generateImagesLive() {
  generateImages_('live');
}

/**
 * Generate video (stub implementation for phase 2)
 */
function generateVideo() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Get selected rows for video generation
    const selectedRows = getSelectedRows_();
    if (!selectedRows.length) {
      ui.alert('No Selection', 'Please select rows to generate videos for.', ui.ButtonSet.OK);
      return;
    }
    
    // Filter rows that are ready for video generation
    const videoReadyRows = selectedRows.filter(row => {
      return row.approved_image_url && row.status_video === 'ready_to_queue';
    });
    
    if (!videoReadyRows.length) {
      ui.alert(
        'Not Ready for Video',
        'No rows are ready for video generation. Requirements:\n' +
        '• approved_image_url must be present\n' +
        '• status_video must be "ready_to_queue"',
        ui.ButtonSet.OK
      );
      return;
    }
    
    // Confirmation dialog with typed verification
    const count = videoReadyRows.length;
    const response = ui.prompt(
      'Generate Videos',
      `Generate videos for ${count} row(s)?\n\nType "${count}" to confirm:`,
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() !== ui.Button.OK) return;
    if (response.getResponseText().trim() !== count.toString()) {
      ui.alert('Cancelled', 'Confirmation number did not match. Operation cancelled.', ui.ButtonSet.OK);
      return;
    }
    
    // Call backend API for video generation (stub)
    const payload = {
      runMode: 'live',
      items: videoReadyRows.map(row => ({
        scene_id: row.scene_id,
        approved_image_url: row.approved_image_url
      }))
    };
    
    // TODO: Implement video generation endpoint
    ui.alert(
      'Video Generation',
      `Video generation is not yet implemented.\n\nWould process ${count} row(s) with approved images.`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    console.error('Video generation error:', error);
    showErrorDialog_('Video Generation Error', error.message);
  }
}

/**
 * Open the sidebar UI for thumbnail management
 */
function openSidebar() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('sidebar')
        .setTitle('AI Generation Sidebar')
        .setWidth(400);
    
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    console.error('Failed to open sidebar:', error);
    showErrorDialog_('Sidebar Error', 'Failed to open sidebar: ' + error.message);
  }
}

/**
 * Core image generation function
 * @param {string} runMode - 'dry_run' or 'live'
 */
function generateImages_(runMode) {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Validate sheet structure
    const validation = validateSheetStructure_();
    if (!validation.valid) {
      ui.alert('Sheet Configuration Error', validation.message, ui.ButtonSet.OK);
      return;
    }
    
    // Get selected rows for processing
    const selectedRows = getSelectedRows_();
    if (!selectedRows.length) {
      ui.alert('No Selection', 'Please select rows to process.', ui.ButtonSet.OK);
      return;
    }
    
    // Filter rows that can be processed (pending status)
    const processableRows = selectedRows.filter(row => {
      return !row.status_img || row.status_img === 'pending' || row.status_img === '';
    });
    
    const maxRows = getMaxRows_();
    const rowsToProcess = processableRows.slice(0, maxRows);
    const skippedRows = processableRows.length - rowsToProcess.length;
    
    if (!rowsToProcess.length) {
      ui.alert(
        'No Processable Rows',
        'Selected rows are not in processable state.\n\nOnly rows with empty status or "pending" can be processed.',
        ui.ButtonSet.OK
      );
      return;
    }
    
    // Calculate cost estimate
    const totalCost = rowsToProcess.reduce((sum, row) => {
      const variants = Math.max(1, Math.min(3, parseInt(row.variants) || 1));
      return sum + (variants * COST_PER_IMAGE);
    }, 0);
    
    // Show confirmation dialog
    let confirmMessage = `Process ${rowsToProcess.length} row(s)`;
    if (skippedRows > 0) {
      confirmMessage += `\n(${skippedRows} row(s) skipped - over limit or already processed)`;
    }
    
    if (runMode === 'live') {
      confirmMessage += `\n\nEstimated cost: $${totalCost.toFixed(4)}\n\nType "${rowsToProcess.length}" to confirm:`;
      
      const response = ui.prompt('Generate Images (Live)', confirmMessage, ui.ButtonSet.OK_CANCEL);
      if (response.getSelectedButton() !== ui.Button.OK) return;
      if (response.getResponseText().trim() !== rowsToProcess.length.toString()) {
        ui.alert('Cancelled', 'Confirmation number did not match. Operation cancelled.', ui.ButtonSet.OK);
        return;
      }
    } else {
      confirmMessage += ' (no cost - dry run)?';
      const result = ui.alert('Generate Images (Dry-Run)', confirmMessage, ui.ButtonSet.YES_NO);
      if (result !== ui.Button.YES) return;
    }
    
    // Prepare API payload
    const payload = {
      runMode: runMode,
      rowFilter: {
        status: 'all',
        limit: rowsToProcess.length
      }
    };
    
    // Show processing indicator
    ui.alert(
      'Processing',
      `Sending ${rowsToProcess.length} row(s) for processing...\n\nThis may take a few moments.`,
      ui.ButtonSet.OK
    );
    
    // Call backend API
    const result = callBackendAPI_('/batch/sheets', payload);
    
    // Show result
    if (runMode === 'dry_run') {
      ui.alert(
        'Dry-Run Complete',
        `Successfully validated ${rowsToProcess.length} row(s).\n\nNo images were generated or costs incurred.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Generation Complete',
        `Successfully processed ${rowsToProcess.length} row(s).\n\nCheck the sheet for generated images and updated costs.`,
        ui.ButtonSet.OK
      );
    }
    
  } catch (error) {
    console.error('Image generation error:', error);
    handleAPIError_(error, runMode);
  }
}

/**
 * Get snapshot of selected rows for sidebar UI
 * @returns {Object} JSON snapshot of selected rows
 */
function getSelectionSnapshot() {
  try {
    const selectedRows = getSelectedRows_();
    return {
      success: true,
      rows: selectedRows,
      totalCost: selectedRows.reduce((sum, row) => {
        const variants = Math.max(1, Math.min(3, parseInt(row.variants) || 1));
        return sum + (variants * COST_PER_IMAGE);
      }, 0)
    };
  } catch (error) {
    console.error('Get selection snapshot error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Approve a thumbnail image for video generation
 * @param {string} sceneId - Scene ID to approve image for
 * @param {string} imageUrl - URL of the approved image
 */
function approveStill(sceneId, imageUrl) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const headers = getSheetHeaders_(sheet);
    const data = sheet.getDataRange().getValues();
    
    // Find the row with matching scene_id
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowSceneId = row[headers.scene_id];
      
      if (rowSceneId === sceneId) {
        // Write approved image URL
        const approvedCol = headers.approved_image_url;
        if (approvedCol !== -1) {
          sheet.getRange(i + 1, approvedCol + 1).setValue(imageUrl);
        } else {
          // Add approved_image_url column if it doesn't exist
          const lastCol = sheet.getLastColumn();
          sheet.getRange(1, lastCol + 1).setValue('approved_image_url');
          sheet.getRange(i + 1, lastCol + 1).setValue(imageUrl);
        }
        
        return { success: true };
      }
    }
    
    throw new Error(`Scene ID "${sceneId}" not found`);
    
  } catch (error) {
    console.error('Approve still error:', error);
    return { success: false, error: error.message };
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get currently selected rows with all relevant data
 * @returns {Array} Array of row objects
 */
function getSelectedRows_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getActiveRange();
  const headers = getSheetHeaders_(sheet);
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  
  // Skip header row if selected
  const dataStartRow = Math.max(startRow, 2);
  const dataNumRows = startRow === 1 ? Math.max(0, numRows - 1) : numRows;
  
  if (dataNumRows <= 0) return [];
  
  const data = sheet.getRange(dataStartRow, 1, dataNumRows, sheet.getLastColumn()).getValues();
  
  return data.map((row, index) => {
    const rowData = {
      rowNumber: dataStartRow + index,
      scene_id: row[headers.scene_id] || '',
      prompt: row[headers.prompt] || '',
      variants: row[headers.variants] || 1,
      status_img: row[headers.status_img] || '',
      nano_img_1: row[headers.nano_img_1] || '',
      nano_img_2: row[headers.nano_img_2] || '',
      nano_img_3: row[headers.nano_img_3] || '',
      job_id: row[headers.job_id] || '',
      error_msg: row[headers.error_msg] || '',
      cost: row[headers.cost] || '',
      approved_image_url: row[headers.approved_image_url] || '',
      status_video: row[headers.status_video] || ''
    };
    
    // Only include rows with scene_id and prompt
    return (rowData.scene_id && rowData.prompt) ? rowData : null;
  }).filter(row => row !== null);
}

/**
 * Get sheet headers mapping
 * @param {Sheet} sheet - Google Sheet object
 * @returns {Object} Header name to column index mapping
 */
function getSheetHeaders_(sheet) {
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = {};
  
  headerRow.forEach((header, index) => {
    if (header) {
      headers[header.toString().toLowerCase()] = index;
    }
  });
  
  return headers;
}

/**
 * Validate sheet structure has required headers
 * @returns {Object} Validation result with valid flag and message
 */
function validateSheetStructure_() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const headers = getSheetHeaders_(sheet);
    const headerNames = Object.keys(headers);
    
    const missingHeaders = REQUIRED_HEADERS.filter(required => 
      !headerNames.includes(required.toLowerCase())
    );
    
    if (missingHeaders.length > 0) {
      return {
        valid: false,
        message: `Missing required headers: ${missingHeaders.join(', ')}\n\n` +
                 'Please see the Google Sheet Template Guide for proper setup:\n' +
                 'Required headers: ' + REQUIRED_HEADERS.join(', ')
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      message: 'Failed to validate sheet structure: ' + error.message
    };
  }
}

/**
 * Get API base URL from configuration
 * @returns {string} API base URL
 */
function getAPIBaseURL_() {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (configSheet) {
      const url = configSheet.getRange(API_BASE_URL_CELL).getValue();
      if (url) return url.toString().replace(/\/$/, ''); // Remove trailing slash
    }
  } catch (error) {
    console.warn('Failed to get API URL from config:', error);
  }
  
  // Fallback to localhost for development
  return 'http://localhost:9090';
}

/**
 * Get maximum rows per batch from configuration
 * @returns {number} Maximum rows per batch
 */
function getMaxRows_() {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (configSheet) {
      const maxRows = configSheet.getRange(MAX_ROWS_CELL).getValue();
      if (maxRows && typeof maxRows === 'number') return Math.max(1, Math.min(100, maxRows));
    }
  } catch (error) {
    console.warn('Failed to get max rows from config:', error);
  }
  
  return DEFAULT_MAX_ROWS;
}

/**
 * Call backend API with proper headers and error handling
 * @param {string} path - API endpoint path
 * @param {Object} payload - Request payload
 * @returns {Object} API response
 */
function callBackendAPI_(path, payload) {
  const baseURL = getAPIBaseURL_();
  const url = baseURL + path;
  const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sheet-id': sheetId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  console.log('Calling API:', url, payload);
  
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const statusCode = response.getResponseCode();
  
  console.log('API Response:', statusCode, responseText);
  
  if (statusCode !== 200) {
    let errorData;
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      errorData = { error: 'UNKNOWN_ERROR', message: responseText };
    }
    
    const error = new Error(errorData.message || 'API request failed');
    error.statusCode = statusCode;
    error.errorData = errorData;
    throw error;
  }
  
  return JSON.parse(responseText);
}

/**
 * Handle API errors with user-friendly messages
 * @param {Error} error - Error object
 * @param {string} context - Context of the operation
 */
function handleAPIError_(error, context = 'operation') {
  const ui = SpreadsheetApp.getUi();
  
  if (error.statusCode === 400 && error.errorData && error.errorData.issues) {
    // Zod validation errors
    const issues = error.errorData.issues.slice(0, 3); // Show first 3 issues
    const issueText = issues.map(issue => `• ${issue.path.join('.')}: ${issue.message}`).join('\n');
    
    ui.alert(
      'Validation Error',
      `Request validation failed:\n\n${issueText}\n\n` +
      (error.errorData.issues.length > 3 ? '...and more issues\n\n' : '') +
      'Please check the QC Checklist for requirements.',
      ui.ButtonSet.OK
    );
  } else if (error.statusCode === 403) {
    ui.alert(
      'Permission Error',
      'Cannot access the Google Sheet. Please ensure the service account has access:\n\n' +
      'orchestrator-sa@solid-study-467023-i3.iam.gserviceaccount.com\n\n' +
      'Share your sheet with this email as an Editor.',
      ui.ButtonSet.OK
    );
  } else if (error.statusCode === 404) {
    ui.alert(
      'Not Found',
      'The API endpoint was not found. Please check your configuration.',
      ui.ButtonSet.OK
    );
  } else {
    // Generic error with retry option
    const result = ui.alert(
      'Network Error',
      `Failed to complete ${context}:\n\n${error.message}\n\nWould you like to retry?`,
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      // Note: Retry would need to be implemented in the calling function
      ui.alert('Retry', 'Please try the operation again manually.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Show error dialog with details
 * @param {string} title - Error dialog title
 * @param {string} message - Error message
 */
function showErrorDialog_(title, message) {
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}

/**
 * Utility function to create a configuration sheet if it doesn't exist
 */
function createConfigSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet(CONFIG_SHEET);
    
    // Set up configuration headers and default values
    configSheet.getRange('A1').setValue('Setting');
    configSheet.getRange('B1').setValue('Value');
    configSheet.getRange('A2').setValue('API_BASE_URL');
    configSheet.getRange('B2').setValue('http://localhost:9090');
    configSheet.getRange('A3').setValue('MAX_ROWS_PER_BATCH');
    configSheet.getRange('B3').setValue(DEFAULT_MAX_ROWS);
    
    // Format the sheet
    configSheet.getRange('A1:B1').setFontWeight('bold');
    configSheet.setColumnWidth(1, 200);
    configSheet.setColumnWidth(2, 300);
  }
  
  return configSheet;
}