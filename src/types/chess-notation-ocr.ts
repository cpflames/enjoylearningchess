/**
 * Shared TypeScript types for Chess Notation OCR API contracts
 * These types are used by both frontend and backend (Lambda) code
 */

// Workflow status types
export type WorkflowStatus = 
  | 'initiated'
  | 'stored'
  | 'processing'
  | 'completed'
  | 'failed';

// Workflow state stored in DynamoDB
export interface WorkflowState {
  workflowId: string;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  s3Key?: string;
  s3Bucket?: string;
  textractJobId?: string;
  extractedText?: string;
  confidence?: number;
  errorMessage?: string;
  ttl: number;
}

// API Request Types
export interface PresignedUrlRequest {
  type: 'generate-presigned-url';
  fileName: string;
  fileType: string;
}

export interface GetStatusRequest {
  type: 'get-status';
  workflowId: string;
}

export interface GetResultsRequest {
  type: 'get-results';
  workflowId: string;
}

export type ApiRequest = 
  | PresignedUrlRequest 
  | GetStatusRequest 
  | GetResultsRequest;

// API Response Types
export interface PresignedUrlResponse {
  presignedUrl: string;
  workflowId: string;
  key: string;
  expiresIn: number;
}

export interface GetStatusResponse {
  workflowId: string;
  status: WorkflowStatus;
  updatedAt: number;
}

export interface GetResultsResponse {
  workflowId: string;
  status: WorkflowStatus;
  extractedText?: string;
  confidence?: number;
  errorMessage?: string;
}

export type ApiResponse = 
  | PresignedUrlResponse 
  | GetStatusResponse 
  | GetResultsResponse 
  | ErrorResponse;

// Error Response
export interface ErrorResponse {
  error: string;
  errorCode: string;
  workflowId?: string;
  retryable: boolean;
}

// Textract Response Types
export interface TextractResult {
  jobId: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  blocks?: TextBlock[];
}

export interface TextBlock {
  blockType: 'LINE' | 'WORD';
  text: string;
  confidence: number;
  geometry: {
    boundingBox: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
  };
}

// File Validation Types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Supported file types
export const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp'
] as const;

export type SupportedFileType = typeof SUPPORTED_FILE_TYPES[number];

// Constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const PRESIGNED_URL_EXPIRATION = 300; // 5 minutes in seconds
export const WORKFLOW_TTL_DAYS = 30;
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY = 100; // milliseconds
