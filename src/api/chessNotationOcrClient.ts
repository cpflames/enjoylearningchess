/**
 * API Client for Chess Notation OCR Lambda Communication
 * 
 * This module provides functions to interact with the Chess Notation OCR Lambda:
 * - Generate pre-signed URLs for S3 uploads
 * - Upload files to S3 with progress tracking
 * - Poll workflow status
 * - Retrieve OCR results
 * 
 * Includes retry logic for network errors and structured error handling.
 */

import {
  PresignedUrlRequest,
  PresignedUrlResponse,
  GetStatusRequest,
  GetStatusResponse,
  GetResultsRequest,
  GetResultsResponse,
  ErrorResponse,
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY
} from '../types/chess-notation-ocr';

// Lambda endpoint URL - should be configured via environment variable in production
const LAMBDA_ENDPOINT = process.env.REACT_APP_CHESS_OCR_LAMBDA_URL || 
  'https://52y22iuzx7.execute-api.us-east-1.amazonaws.com/';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public errorCode: string,
    public retryable: boolean,
    public workflowId?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, baseDelay: number = INITIAL_RETRY_DELAY): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const maxDelay = 3200; // Maximum delay of 3.2 seconds
  const delay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Check if an error is retryable based on status code or error type
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // HTTP status codes that should be retried
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  
  // API error with retryable flag
  if (error instanceof ApiError && error.retryable) {
    return true;
  }
  
  return false;
}

/**
 * Make an API request with retry logic
 */
async function makeApiRequest<T>(
  requestBody: PresignedUrlRequest | GetStatusRequest | GetResultsRequest,
  maxRetries: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      // Check if response is an error
      if (!response.ok || data.error) {
        const errorData = data as ErrorResponse;
        throw new ApiError(
          errorData.error || 'Request failed',
          errorData.errorCode || 'UNKNOWN_ERROR',
          errorData.retryable || false,
          errorData.workflowId,
          response.status
        );
      }
      
      return data as T;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries - 1 || !isRetryableError(error)) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = calculateBackoffDelay(attempt);
      await sleep(delay);
    }
  }
  
  // All retries failed, throw the last error
  if (lastError instanceof ApiError) {
    throw lastError;
  }
  
  throw new ApiError(
    lastError?.message || 'Request failed after retries',
    'NETWORK_ERROR',
    false
  );
}

/**
 * Generate a pre-signed URL for uploading a file to S3
 * 
 * @param fileName - Original filename
 * @param fileType - MIME type of the file
 * @returns Promise resolving to pre-signed URL response
 * @throws ApiError if request fails
 */
export async function generatePresignedUrl(
  fileName: string,
  fileType: string
): Promise<PresignedUrlResponse> {
  const request: PresignedUrlRequest = {
    type: 'generate-presigned-url',
    fileName,
    fileType
  };
  
  return makeApiRequest<PresignedUrlResponse>(request);
}

/**
 * Upload a file to S3 using a pre-signed URL with progress tracking
 * 
 * @param presignedUrl - Pre-signed URL from generatePresignedUrl
 * @param file - File to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Promise resolving when upload completes
 * @throws Error if upload fails
 */
export async function uploadToS3(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      });
    }
    
    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });
    
    // Send the request
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Get the current status of a workflow
 * 
 * @param workflowId - Workflow identifier
 * @returns Promise resolving to workflow status
 * @throws ApiError if request fails
 */
export async function getWorkflowStatus(
  workflowId: string
): Promise<GetStatusResponse> {
  const request: GetStatusRequest = {
    type: 'get-status',
    workflowId
  };
  
  return makeApiRequest<GetStatusResponse>(request);
}

/**
 * Get the results of a completed workflow
 * 
 * @param workflowId - Workflow identifier
 * @returns Promise resolving to workflow results
 * @throws ApiError if request fails
 */
export async function getWorkflowResults(
  workflowId: string
): Promise<GetResultsResponse> {
  const request: GetResultsRequest = {
    type: 'get-results',
    workflowId
  };
  
  return makeApiRequest<GetResultsResponse>(request);
}

/**
 * Poll workflow status until completion or failure
 * 
 * @param workflowId - Workflow identifier
 * @param onStatusUpdate - Optional callback for status updates
 * @param pollInterval - Polling interval in milliseconds (default: 2000)
 * @param maxPollTime - Maximum polling time in milliseconds (default: 300000 = 5 minutes)
 * @returns Promise resolving to final workflow results
 * @throws ApiError if polling fails or times out
 */
export async function pollWorkflowUntilComplete(
  workflowId: string,
  onStatusUpdate?: (status: GetStatusResponse) => void,
  pollInterval: number = 2000,
  maxPollTime: number = 300000
): Promise<GetResultsResponse> {
  const startTime = Date.now();
  
  while (true) {
    // Check if we've exceeded max poll time
    if (Date.now() - startTime > maxPollTime) {
      throw new ApiError(
        'Polling timeout: workflow did not complete in time',
        'POLLING_TIMEOUT',
        false,
        workflowId
      );
    }
    
    // Get current results (which also checks Textract status)
    try {
      const resultsResponse = await getWorkflowResults(workflowId);
      
      // Notify callback with status if provided
      if (onStatusUpdate) {
        onStatusUpdate({
          workflowId: resultsResponse.workflowId,
          status: resultsResponse.status,
          updatedAt: Date.now()
        });
      }
      
      // Check if workflow is in a terminal state
      if (resultsResponse.status === 'completed' || resultsResponse.status === 'failed') {
        return resultsResponse;
      }
    } catch (error) {
      // If get-results fails, fall back to get-status
      const statusResponse = await getWorkflowStatus(workflowId);
      
      if (onStatusUpdate) {
        onStatusUpdate(statusResponse);
      }
      
      // If status shows completed/failed, try get-results again
      if (statusResponse.status === 'completed' || statusResponse.status === 'failed') {
        return await getWorkflowResults(workflowId);
      }
    }
    
    // Wait before next poll
    await sleep(pollInterval);
  }
}
