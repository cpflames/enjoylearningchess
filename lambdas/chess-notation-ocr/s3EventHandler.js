const AWS = require("aws-sdk");
const { updateWorkflowStatus } = require("./workflowStateManager");
const { startTextractJob } = require("./textractOrchestrator");
const { 
  logInternalError, 
  logInfo,
  logDebug 
} = require("./errorLogger");

const textract = new AWS.Textract();

// Retry configuration for exponential backoff
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 100,  // milliseconds
  maxDelay: 3200,     // milliseconds
  jitter: 0.25        // ±25%
};

/**
 * Parse S3 event to extract bucket and key
 * @param {Object} s3Event - S3 event from Lambda trigger
 * @returns {Object} Object containing bucket and key
 * @throws {Error} If event structure is invalid
 */
function parseS3Event(s3Event) {
  if (!s3Event.Records || s3Event.Records.length === 0) {
    const error = new Error('Invalid S3 event: no records found');
    logInternalError(error, 'parseS3Event');
    throw error;
  }
  
  const record = s3Event.Records[0];
  
  if (!record.s3 || !record.s3.bucket || !record.s3.object) {
    const error = new Error('Invalid S3 event: missing s3 data');
    logInternalError(error, 'parseS3Event');
    throw error;
  }
  
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  logDebug('S3 event parsed', 'parseS3Event', { bucket, key });
  
  return { bucket, key };
}

/**
 * Extract workflow ID from S3 key
 * Expected format: notation-uploads/{workflowId}/{timestamp}-{filename}
 * @param {string} key - S3 object key
 * @returns {string} Workflow ID
 * @throws {Error} If key format is invalid
 */
function extractWorkflowId(key) {
  const parts = key.split('/');
  
  if (parts.length < 2 || parts[0] !== 'notation-uploads') {
    const error = new Error(`Invalid S3 key format: ${key}`);
    logInternalError(error, 'extractWorkflowId', { key });
    throw error;
  }
  
  const workflowId = parts[1];
  
  if (!workflowId || workflowId.length === 0) {
    const error = new Error(`Could not extract workflow ID from key: ${key}`);
    logInternalError(error, 'extractWorkflowId', { key });
    throw error;
  }
  
  logDebug('Workflow ID extracted', 'extractWorkflowId', { workflowId, key });
  
  return workflowId;
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
  const exponentialDelay = RETRY_CONFIG.initialDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelay);
  
  // Add jitter: ±25%
  const jitterRange = cappedDelay * RETRY_CONFIG.jitter;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise<any>} Result of the function
 * @throws {Error} If all retry attempts fail
 */
async function retryWithBackoff(fn, operationName) {
  let lastError;
  
  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      logDebug(`${operationName} - Attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts}`, 'retryWithBackoff');
      const result = await fn();
      
      if (attempt > 0) {
        logInfo(`${operationName} succeeded after ${attempt + 1} attempts`, 'retryWithBackoff');
      }
      
      return result;
    } catch (err) {
      lastError = err;
      
      // Check if error is retryable
      const isRetryable = 
        err.code === 'ThrottlingException' ||
        err.code === 'ProvisionedThroughputExceededException' ||
        err.code === 'ServiceUnavailable' ||
        err.statusCode === 503 ||
        err.statusCode === 429;
      
      if (!isRetryable) {
        logInternalError(err, 'retryWithBackoff', {
          operationName,
          attempt: attempt + 1,
          reason: 'Non-retryable error'
        });
        throw err;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === RETRY_CONFIG.maxAttempts - 1) {
        logInternalError(err, 'retryWithBackoff', {
          operationName,
          totalAttempts: RETRY_CONFIG.maxAttempts,
          reason: 'All retry attempts exhausted'
        });
        throw err;
      }
      
      // Calculate delay and wait before next attempt
      const delay = calculateBackoffDelay(attempt);
      logDebug(`${operationName} - Waiting ${delay}ms before retry`, 'retryWithBackoff', {
        attempt: attempt + 1,
        errorCode: err.code
      });
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Handle S3 event: update workflow status and trigger Textract
 * @param {Object} s3Event - S3 event from Lambda trigger
 * @returns {Promise<Object>} Result object with workflowId and status
 * @throws {Error} If processing fails
 */
async function handleS3Event(s3Event) {
  let workflowId;
  
  try {
    // Parse S3 event to extract bucket and key
    const { bucket, key } = parseS3Event(s3Event);
    
    // Extract workflow ID from key
    workflowId = extractWorkflowId(key);
    
    // Update workflow status to "stored" with retry
    await retryWithBackoff(
      async () => {
        return await updateWorkflowStatus(workflowId, 'stored', {
          s3Key: key,
          s3Bucket: bucket
        });
      },
      'Update workflow status to stored'
    );
    
    logInfo('S3 event processed, workflow updated to stored', 'handleS3Event', {
      workflowId,
      bucket,
      key
    });
    
    // Start Textract job with retry
    let textractJobId;
    try {
      textractJobId = await retryWithBackoff(
        async () => {
          return await startTextractJob(bucket, key);
        },
        'Start Textract job'
      );
      
      logInfo('Textract job started successfully', 'handleS3Event', {
        workflowId,
        textractJobId
      });
      
      // Update workflow status to "processing" with Textract job ID
      await retryWithBackoff(
        async () => {
          return await updateWorkflowStatus(workflowId, 'processing', {
            textractJobId
          });
        },
        'Update workflow status to processing'
      );
      
      logInfo('Workflow updated to processing status', 'handleS3Event', {
        workflowId,
        textractJobId
      });
      
      return {
        workflowId,
        status: 'processing',
        bucket,
        key,
        textractJobId
      };
    } catch (textractErr) {
      logInternalError(textractErr, 'handleS3Event', {
        workflowId,
        bucket,
        key,
        reason: 'Failed to start Textract job'
      });
      
      // Update workflow status to failed with error details
      await updateWorkflowStatus(workflowId, 'failed', {
        errorMessage: `Textract job failed to start: ${textractErr.message}`
      });
      
      throw textractErr;
    }
  } catch (err) {
    logInternalError(err, 'handleS3Event', {
      workflowId,
      hasRecords: !!s3Event.Records
    });
    
    // Try to update workflow status to failed if we have a workflow ID
    if (workflowId) {
      try {
        await updateWorkflowStatus(workflowId, 'failed', {
          errorMessage: `S3 event processing failed: ${err.message}`
        });
      } catch (updateErr) {
        logInternalError(updateErr, 'handleS3Event', {
          workflowId,
          reason: 'Failed to update workflow status to failed'
        });
      }
    }
    
    throw err;
  }
}

module.exports = {
  handleS3Event,
  parseS3Event,
  extractWorkflowId,
  calculateBackoffDelay,
  retryWithBackoff,
  RETRY_CONFIG
};
