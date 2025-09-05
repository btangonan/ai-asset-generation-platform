import { google } from 'googleapis';
import type { SheetRow } from '@ai-platform/shared';

export interface SheetUpdate {
  sceneId: string;
  updates: Partial<SheetRow>;
}

export interface BatchUpdateResult {
  updatedRows: number;
  errors: Array<{ sceneId: string; error: string }>;
}

export class SheetsClient {
  private readonly sheets;
  private readonly spreadsheetId: string;

  constructor(spreadsheetId: string, apiKey?: string) {
    this.spreadsheetId = spreadsheetId;
    
    // Initialize Google Sheets API client
    if (apiKey) {
      this.sheets = google.sheets({ version: 'v4', auth: apiKey });
    } else {
      // Use Application Default Credentials
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth });
    }
  }

  async getRows(range: string = 'A:Z'): Promise<SheetRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      // Convert array of arrays to typed objects
      const [headers, ...dataRows] = rows;
      return dataRows.map(row => this.arrayToSheetRow(headers as string[], row as string[]));
    } catch (error) {
      console.error('Failed to get rows from sheet:', error);
      throw new Error(`Failed to read from sheet: ${error}`);
    }
  }

  async updateRow(sceneId: string, updates: Partial<SheetRow>): Promise<void> {
    const batch = [{ sceneId, updates }];
    await this.batchUpdate(batch);
  }

  async batchUpdate(updates: SheetUpdate[]): Promise<BatchUpdateResult> {
    const errors: Array<{ sceneId: string; error: string }> = [];
    let updatedRows = 0;

    try {
      // Get current data to find row indices
      const currentRows = await this.getRows();
      const rowMap = new Map(
        currentRows.map((row, index) => [row.scene_id, index + 2]) // +2 for header and 1-based indexing
      );

      // Prepare batch update request
      const requests = updates.map(({ sceneId, updates: rowUpdates }) => {
        const rowIndex = rowMap.get(sceneId);
        if (!rowIndex) {
          errors.push({ sceneId, error: 'Scene ID not found in sheet' });
          return null;
        }

        // Convert updates to column-value pairs
        const values = this.sheetRowToArray(rowUpdates);
        
        return {
          range: `A${rowIndex}:Z${rowIndex}`,
          values: [values],
        };
      }).filter((request): request is NonNullable<typeof request> => request !== null);

      if (requests.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: requests,
          },
        });

        updatedRows = requests.length;
      }

      return { updatedRows, errors };
    } catch (error) {
      console.error('Failed to batch update sheet:', error);
      throw new Error(`Failed to update sheet: ${error}`);
    }
  }

  // Convert sheet row array to typed object
  private arrayToSheetRow(headers: string[], values: string[]): SheetRow {
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Type conversions based on expected schema
      if (header === 'duration_s' || header === 'fps' || header === 'resolution') {
        row[header] = value ? Number(value) : (header === 'duration_s' ? 8 : header === 'fps' ? 24 : 720);
      } else if (header === 'est_cost_video') {
        row[header] = value ? Number(value) : 0;
      } else {
        row[header] = value;
      }
    });

    // Set defaults for future-proofed fields
    return {
      scene_id: row.scene_id || '',
      mode: row.mode || 'variation',
      prompt: row.prompt || '',
      ref_pack_id: row.ref_pack_id || '',
      ref_pack_url: row.ref_pack_url || '',
      ref_pack_public_url: row.ref_pack_public_url || '',
      style_kit_id: row.style_kit_id,
      status_img: row.status_img || 'queued',
      nano_img_1: row.nano_img_1,
      nano_img_2: row.nano_img_2,
      nano_img_3: row.nano_img_3,
      approved_image_url: row.approved_image_url,
      veo_model: row.veo_model || 'veo3_fast',
      aspect: row.aspect || '16:9',
      resolution: row.resolution || 720,
      duration_s: 8,
      fps: 24,
      est_cost_video: row.est_cost_video || 0,
      status_video: row.status_video || 'ready_to_queue',
      video_url: row.video_url,
      job_id: row.job_id,
      locked_by: row.locked_by,
    } as SheetRow;
  }

  // Convert typed object to sheet row array
  private sheetRowToArray(row: Partial<SheetRow>): string[] {
    // Define column order (should match sheet template)
    const columnOrder = [
      'scene_id', 'mode', 'prompt', 'ref_pack_id', 'ref_pack_url', 'ref_pack_public_url',
      'style_kit_id', 'status_img', 'nano_img_1', 'nano_img_2', 'nano_img_3',
      'approved_image_url', 'veo_model', 'aspect', 'resolution', 'duration_s', 'fps',
      'est_cost_video', 'status_video', 'video_url', 'job_id', 'locked_by'
    ];

    return columnOrder.map(col => String(row[col as keyof SheetRow] || ''));
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      return true;
    } catch (error) {
      console.error('Sheets client health check failed:', error);
      return false;
    }
  }
}