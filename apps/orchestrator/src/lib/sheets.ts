import { google, sheets_v4 } from 'googleapis';
import { env } from './env.js';
import { logger } from './logger.js';

const sheets = google.sheets('v4');

interface SheetUpdateData {
  status_img?: 'running' | 'awaiting_review' | 'error' | 'completed';
  nano_img_1?: string;
  nano_img_2?: string;
  nano_img_3?: string;
  job_id?: string;
  error_msg?: string;
}

/**
 * Update a row in the Google Sheet by scene_id
 * Uses exponential backoff for retries on 429/5xx
 */
export async function updateSheetRow(
  sheetId: string,
  sceneId: string,
  data: SheetUpdateData,
  attempt: number = 0
): Promise<void> {
  const maxRetries = 4;
  const baseDelay = 1000;
  
  try {
    // First, find the row with this scene_id
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    };
    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      authOptions.keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    
    const authClient = await auth.getClient();
    
    // Get all data to find the row
    const response = await sheets.spreadsheets.values.get({
      auth: authClient as any,
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z', // Adjust range as needed
    });
    
    const rows = response.data.values || [];
    const headerRow = rows[0] || [];
    const sceneIdColumn = headerRow.indexOf('scene_id');
    
    if (sceneIdColumn === -1) {
      throw new Error('scene_id column not found in sheet');
    }
    
    // Find the row with matching scene_id
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[sceneIdColumn] === sceneId) {
        rowIndex = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`Row with scene_id ${sceneId} not found`);
    }
    
    // Build update values based on column positions
    const updates: any[] = [];
    
    if (data.status_img !== undefined) {
      const col = headerRow.indexOf('status_img');
      if (col >= 0) {
        updates.push({
          range: `Sheet1!${columnToLetter(col + 1)}${rowIndex}`,
          values: [[data.status_img]],
        });
      }
    }
    
    if (data.nano_img_1 !== undefined) {
      const col = headerRow.indexOf('nano_img_1');
      if (col >= 0) {
        updates.push({
          range: `Sheet1!${columnToLetter(col + 1)}${rowIndex}`,
          values: [[data.nano_img_1]],
        });
      }
    }
    
    if (data.nano_img_2 !== undefined) {
      const col = headerRow.indexOf('nano_img_2');
      if (col >= 0) {
        updates.push({
          range: `Sheet1!${columnToLetter(col + 1)}${rowIndex}`,
          values: [[data.nano_img_2]],
        });
      }
    }
    
    if (data.nano_img_3 !== undefined) {
      const col = headerRow.indexOf('nano_img_3');
      if (col >= 0) {
        updates.push({
          range: `Sheet1!${columnToLetter(col + 1)}${rowIndex}`,
          values: [[data.nano_img_3]],
        });
      }
    }
    
    if (data.job_id !== undefined) {
      const col = headerRow.indexOf('job_id');
      if (col >= 0) {
        updates.push({
          range: `Sheet1!${columnToLetter(col + 1)}${rowIndex}`,
          values: [[data.job_id]],
        });
      }
    }
    
    // Batch update all cells
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        auth: authClient as any,
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
      
      logger.info({ sceneId, updates: updates.length }, 'Sheet updated successfully');
    }
  } catch (error: any) {
    // Retry on rate limit or server errors
    if (attempt < maxRetries && (error.code === 429 || error.code >= 500)) {
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      logger.warn({ sceneId, attempt, delay }, 'Retrying sheet update after delay');
      await new Promise(resolve => setTimeout(resolve, delay));
      return updateSheetRow(sheetId, sceneId, data, attempt + 1);
    }
    
    logger.error({ error, sceneId }, 'Failed to update sheet');
    throw error;
  }
}

/**
 * Convert column number to letter (1=A, 2=B, etc.)
 */
function columnToLetter(column: number): string {
  let temp: number;
  let letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Get selected rows from sheet
 */
export async function getSelectedRows(
  sheetId: string,
  rowIds: string[]
): Promise<any[]> {
  try {
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    };
    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      authOptions.keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    
    const authClient = await auth.getClient();
    
    const response = await sheets.spreadsheets.values.get({
      auth: authClient as any,
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z',
    });
    
    const rows = response.data.values || [];
    const headers = rows[0] || [];
    
    // Convert rows to objects
    const result: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const sceneId = row[headers.indexOf('scene_id')];
      
      if (rowIds.includes(sceneId)) {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        result.push(obj);
      }
    }
    
    return result;
  } catch (error) {
    logger.error({ error, sheetId }, 'Failed to get rows from sheet');
    throw error;
  }
}