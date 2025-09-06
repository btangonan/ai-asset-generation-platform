/**
 * Type definitions for the Batch UI MVP
 * 
 * Aligned with orchestrator API and RFC 7807 error format
 */

// ================================
// Core Domain Types
// ================================

export interface BatchRow {
  sceneId: string;
  prompt: string;
  variants: number;
  lineNumber?: number;
}

export interface ParsedBatch {
  rows: BatchRow[];
  totalImages: number;
  estimatedCost: number;
  hash?: string;
}

// ================================
// API Request/Response Types
// ================================

export interface BatchImageRequest {
  rows: Array<{
    sceneId: string;
    prompt: string;
    variants: number;
  }>;
  mode: 'dry_run' | 'live';
  uploadedImages?: string[]; // GCS URLs
}

export interface BatchImageResponse {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  mode: 'dry_run' | 'live';
  totalImages: number;
  processedImages: number;
  estimatedCost: number;
  actualCost?: number;
  results?: ImageResult[];
  error?: ProblemDetails;
  createdAt: string;
  completedAt?: string;
}

export interface ImageResult {
  sceneId: string;
  variantIndex: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    sizeBytes: number;
  };
}

export interface BatchVideoRequest {
  rows: Array<{
    sceneId: string;
    prompt: string;
    duration: number; // seconds
  }>;
  mode: 'dry_run' | 'live';
  approvalRequired: boolean;
}

export interface BatchVideoResponse {
  batchId: string;
  status: 'pending' | 'awaiting_approval' | 'processing' | 'completed' | 'failed';
  mode: 'dry_run' | 'live';
  totalVideos: number;
  processedVideos: number;
  estimatedCost: number;
  actualCost?: number;
  results?: VideoResult[];
  error?: ProblemDetails;
  createdAt: string;
  completedAt?: string;
}

export interface VideoResult {
  sceneId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  metadata?: {
    width: number;
    height: number;
    duration: number;
    format: string;
    sizeBytes: number;
  };
}

// ================================
// File Upload Types
// ================================

export interface SignedUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface SignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
}

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// ================================
// Status & Monitoring Types
// ================================

export interface BatchStatus {
  batchId: string;
  type: 'images' | 'videos';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  estimatedTimeRemaining?: number; // seconds
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SystemStatus {
  healthy: boolean;
  version: string;
  uptime: number;
  limits: {
    maxRowsPerBatch: number;
    maxVariantsPerRow: number;
    maxFileSizeMB: number;
    rateLimitPerMinute: number;
  };
}

// ================================
// Error Types (RFC 7807)
// ================================

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, any>;
}

// Common problem types
export const ProblemTypes = {
  VALIDATION_ERROR: '/problems/validation-error',
  RATE_LIMIT_EXCEEDED: '/problems/rate-limit-exceeded',
  PERMISSION_DENIED: '/problems/permission-denied',
  RESOURCE_NOT_FOUND: '/problems/resource-not-found',
  INTERNAL_ERROR: '/problems/internal-error',
  BUDGET_EXCEEDED: '/problems/budget-exceeded',
  INVALID_FILE_FORMAT: '/problems/invalid-file-format',
} as const;

// ================================
// UI State Types
// ================================

export interface BatchSession {
  id: string;
  batch: ParsedBatch;
  uploadedFiles: UploadedFile[];
  dryRunResult?: BatchImageResponse;
  liveRunResult?: BatchImageResponse;
  approvals: Set<string>; // Approved batch IDs
  createdAt: string;
  lastModified: string;
}

export interface UIState {
  currentPhase: 'editing' | 'dry_run' | 'approval' | 'live_run' | 'completed';
  isLoading: boolean;
  error?: ProblemDetails;
  session?: BatchSession;
}

export interface CostBreakdown {
  images: {
    count: number;
    unitCost: number;
    totalCost: number;
  };
  videos?: {
    count: number;
    unitCost: number;
    totalCost: number;
  };
  storage?: {
    sizeMB: number;
    unitCost: number;
    totalCost: number;
  };
  grandTotal: number;
}

// ================================
// Configuration Types
// ================================

export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  limits: {
    maxRows: number;
    maxVariantsPerRow: number;
    maxFileSizeMB: number;
    maxTotalImages: number;
  };
  costs: {
    perImage: number;
    perVideo: number;
    perGBStorage: number;
  };
  features: {
    useMockData: boolean;
    enableVideoGeneration: boolean;
    requireApproval: boolean;
  };
}

// ================================
// Utility Types
// ================================

export type BatchMode = 'dry_run' | 'live';
export type BatchType = 'images' | 'videos';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TimeRange {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}