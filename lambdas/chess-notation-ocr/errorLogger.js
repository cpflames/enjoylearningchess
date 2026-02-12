const AWS = require("aws-sdk");

/**
 * Error logging utility for structured error logging with CloudWatch formatting
 * Implements comprehensive error logging with all required fields per Requirements 6.1-6.5
 */

/**
 * Log levels for categorizing errors
 */
const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Error categories for classification
 */
const ErrorCategory = {
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  S3: 'S3',
  TEXTRACT: 'TEXTRACT',
  DYNAMODB: 'DYNAMODB',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Log a structured error with all required fields
 * @param {Object} options - Error logging options
 * @param {Error|string} options.error - Error object or message
 * @param {string} options.context - Context where error occurred (e.g., 'handlePresignedUrl', 'startTextractJob')
 * @param {string} [options.workflowId] - Workflow ID (user identifier) if available
 * @param {string} [options.category=ErrorCategory.UNKNOWN] - Error category
 * @param {string} [options.level=LogLevel.ERROR] - Log level
 * @param {Object} [options.metadata={}] - Additional metadata for debugging
 * @param {boolean} [options.retryable=false] - Whether the error is retryable
 */
function logError({
  error,
  context,
  workflowId = null,
  category = ErrorCategory.UNKNOWN,
  level = LogLevel.ERROR,
  metadata = {},
  retryable = false
}) {
  // Extract error details
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : null;
  const errorCode = error.code || error.name || 'UNKNOWN_ERROR';
  
  // Create structured log entry with all required fields per Requirement 6.5
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    context,
    errorMessage,
    errorCode,
    retryable,
    ...(workflowId && { workflowId }),
    ...(errorStack && { errorStack }),
    ...metadata
  };
  
  // Format for CloudWatch Logs
  const cloudWatchMessage = JSON.stringify(logEntry);
  
  // Log to console (which goes to CloudWatch in Lambda)
  switch (level) {
    case LogLevel.ERROR:
      console.error(cloudWatchMessage);
      break;
    case LogLevel.WARN:
      console.warn(cloudWatchMessage);
      break;
    case LogLevel.INFO:
      console.info(cloudWatchMessage);
      break;
    case LogLevel.DEBUG:
      console.debug(cloudWatchMessage);
      break;
    default:
      console.log(cloudWatchMessage);
  }
  
  return logEntry;
}

/**
 * Log a validation error
 * @param {string} message - Error message
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logValidationError(message, context, options = {}) {
  return logError({
    error: message,
    context,
    category: ErrorCategory.VALIDATION,
    level: LogLevel.WARN,
    retryable: false,
    ...options
  });
}

/**
 * Log a network error
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logNetworkError(error, context, options = {}) {
  return logError({
    error,
    context,
    category: ErrorCategory.NETWORK,
    retryable: true,
    ...options
  });
}

/**
 * Log an S3 error
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logS3Error(error, context, options = {}) {
  // Determine if S3 error is retryable
  const retryable = 
    error.code === 'RequestTimeout' ||
    error.code === 'ServiceUnavailable' ||
    error.statusCode === 503 ||
    error.statusCode === 429;
  
  return logError({
    error,
    context,
    category: ErrorCategory.S3,
    retryable,
    ...options
  });
}

/**
 * Log a Textract error
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logTextractError(error, context, options = {}) {
  // Determine if Textract error is retryable
  const retryable = 
    error.code === 'ThrottlingException' ||
    error.code === 'ProvisionedThroughputExceededException' ||
    error.code === 'ServiceUnavailable' ||
    error.statusCode === 503 ||
    error.statusCode === 429;
  
  return logError({
    error,
    context,
    category: ErrorCategory.TEXTRACT,
    retryable,
    ...options
  });
}

/**
 * Log a DynamoDB error
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logDynamoDBError(error, context, options = {}) {
  // Determine if DynamoDB error is retryable
  const retryable = 
    error.code === 'ProvisionedThroughputExceededException' ||
    error.code === 'RequestLimitExceeded' ||
    error.code === 'ServiceUnavailable' ||
    error.statusCode === 503 ||
    error.statusCode === 429;
  
  return logError({
    error,
    context,
    category: ErrorCategory.DYNAMODB,
    retryable,
    ...options
  });
}

/**
 * Log an internal error
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {Object} [options={}] - Additional options
 */
function logInternalError(error, context, options = {}) {
  return logError({
    error,
    context,
    category: ErrorCategory.INTERNAL,
    retryable: false,
    ...options
  });
}

/**
 * Log an informational message
 * @param {string} message - Info message
 * @param {string} context - Context
 * @param {Object} [metadata={}] - Additional metadata
 */
function logInfo(message, context, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    context,
    message,
    ...metadata
  };
  
  console.info(JSON.stringify(logEntry));
  return logEntry;
}

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {string} context - Context
 * @param {Object} [metadata={}] - Additional metadata
 */
function logDebug(message, context, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.DEBUG,
    context,
    message,
    ...metadata
  };
  
  console.debug(JSON.stringify(logEntry));
  return logEntry;
}

module.exports = {
  logError,
  logValidationError,
  logNetworkError,
  logS3Error,
  logTextractError,
  logDynamoDBError,
  logInternalError,
  logInfo,
  logDebug,
  LogLevel,
  ErrorCategory
};
