/**
 * Batch Parser Utility
 * Handles parsing and validation of batch prompt format: "scene_id | prompt | variants"
 */

export interface BatchRow {
  sceneId: string;
  prompt: string;
  variants: number;
  lineNumber: number; // For error reporting
}

export interface ParseResult {
  rows: BatchRow[];
  errors: string[];
  totalImages: number;
  estimatedCost: number;
}

export interface ParseOptions {
  maxRows?: number;
  maxVariantsPerRow?: number;
  costPerImage?: number;
}

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  maxRows: 10,
  maxVariantsPerRow: 3,
  costPerImage: 0.002
};

/**
 * Parse batch input text into structured rows
 * Format: "scene_id | prompt | variants"
 * 
 * @param input - Raw batch text input
 * @param options - Parsing options and limits
 * @returns Parsed rows with validation errors
 */
export function parseBatchInput(
  input: string,
  options: ParseOptions = {}
): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = input.split('\n');
  const rows: BatchRow[] = [];
  const errors: string[] = [];
  let totalImages = 0;

  // Process each line
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    // Check row limit
    if (rows.length >= opts.maxRows) {
      errors.push(`Line ${lineNumber}: Exceeded maximum rows (${opts.maxRows})`);
      return;
    }

    // Parse pipe-delimited format
    const parts = trimmedLine.split('|').map(p => p.trim());

    if (parts.length !== 3) {
      errors.push(
        `Line ${lineNumber}: Invalid format. Expected "scene_id | prompt | variants", got "${trimmedLine}"`
      );
      return;
    }

    const [sceneId, prompt, variantsStr] = parts;

    // Validate scene_id
    if (!sceneId) {
      errors.push(`Line ${lineNumber}: Missing scene_id`);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(sceneId)) {
      errors.push(
        `Line ${lineNumber}: Invalid scene_id "${sceneId}". Only alphanumeric, underscore, and hyphen allowed`
      );
      return;
    }

    if (sceneId.length > 50) {
      errors.push(`Line ${lineNumber}: scene_id too long (max 50 characters)`);
      return;
    }

    // Validate prompt
    if (!prompt) {
      errors.push(`Line ${lineNumber}: Missing prompt`);
      return;
    }

    if (prompt.length > 1000) {
      errors.push(`Line ${lineNumber}: Prompt too long (max 1000 characters)`);
      return;
    }

    // Validate variants
    const variants = parseInt(variantsStr, 10);
    
    if (isNaN(variants)) {
      errors.push(`Line ${lineNumber}: Invalid variants "${variantsStr}". Must be a number`);
      return;
    }

    if (variants < 1) {
      errors.push(`Line ${lineNumber}: Variants must be at least 1`);
      return;
    }

    if (variants > opts.maxVariantsPerRow) {
      errors.push(
        `Line ${lineNumber}: Too many variants (${variants}). Maximum is ${opts.maxVariantsPerRow}`
      );
      return;
    }

    // Check for duplicate scene_ids
    const duplicate = rows.find(r => r.sceneId === sceneId);
    if (duplicate) {
      errors.push(
        `Line ${lineNumber}: Duplicate scene_id "${sceneId}" (first seen on line ${duplicate.lineNumber})`
      );
      return;
    }

    // Add valid row
    rows.push({
      sceneId,
      prompt,
      variants,
      lineNumber
    });

    totalImages += variants;
  });

  // Calculate estimated cost
  const estimatedCost = totalImages * opts.costPerImage;

  // Add summary validation
  if (totalImages > opts.maxRows * opts.maxVariantsPerRow) {
    errors.push(
      `Total images (${totalImages}) exceeds maximum (${opts.maxRows * opts.maxVariantsPerRow})`
    );
  }

  return {
    rows,
    errors,
    totalImages,
    estimatedCost
  };
}

/**
 * Validate a single batch row
 * Used for real-time validation as user types
 */
export function validateBatchRow(
  sceneId: string,
  prompt: string,
  variants: number,
  options: ParseOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];

  // Validate scene_id
  if (!sceneId) {
    errors.push('Scene ID is required');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(sceneId)) {
    errors.push('Scene ID can only contain letters, numbers, underscore, and hyphen');
  } else if (sceneId.length > 50) {
    errors.push('Scene ID too long (max 50 characters)');
  }

  // Validate prompt
  if (!prompt) {
    errors.push('Prompt is required');
  } else if (prompt.length > 1000) {
    errors.push('Prompt too long (max 1000 characters)');
  }

  // Validate variants
  if (variants < 1) {
    errors.push('At least 1 variant required');
  } else if (variants > opts.maxVariantsPerRow) {
    errors.push(`Too many variants (max ${opts.maxVariantsPerRow})`);
  }

  return errors;
}

/**
 * Format batch rows back to text format
 * Useful for displaying normalized input
 */
export function formatBatchRows(rows: BatchRow[]): string {
  return rows
    .map(row => `${row.sceneId} | ${row.prompt} | ${row.variants}`)
    .join('\n');
}

/**
 * Create example batch text for user guidance
 */
export function getExampleBatch(): string {
  return `forest_1 | A mystical forest with glowing mushrooms at twilight | 2
city_night | Cyberpunk cityscape with neon lights and flying cars | 3
ocean_sunset | Dramatic ocean waves crashing against cliffs at sunset | 1`;
}