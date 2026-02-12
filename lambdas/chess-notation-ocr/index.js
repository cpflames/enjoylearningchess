const AWS = require("aws-sdk");
const { generatePresignedUrl } = require("./presignedUrlGenerator");
const { handleS3Event } = require("./s3EventHandler");
const { 
  logValidationError, 
  logInternalError,
  logInfo,
  ErrorCategory 
} = require("./errorLogger");

const s3 = new AWS.S3();
const textract = new AWS.Textract();
const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Get CORS headers for responses
 * Allows production domain and localhost for development
 * @param {Object} event - Lambda event object (to check Origin header)
 * @returns {Object} CORS headers
 */
function getCorsHeaders(event) {
  const allowedOrigins = [
    'https://enjoylearningchess.com',
    'http://localhost:8080',
    'http://localhost:3000'  // In case you use default React port
  ];
  
  // Get the origin from the request
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
  
  // Check if the request origin is in our allowed list
  const allowedOrigin = allowedOrigins.includes(requestOrigin) 
    ? requestOrigin 
    : allowedOrigins[0]; // Default to production domain
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };
}

/**
 * Determine the type of request based on the event structure
 * @param {Object} event - Lambda event object
 * @returns {string} Request type identifier
 */
function determineRequestType(event) {
  // S3 event trigger
  if (event.Records && event.Records[0] && event.Records[0].s3) {
    return 's3-trigger';
  }
  
  // API Gateway or Lambda function URL request
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      return body.type || 'unknown';
    } catch (err) {
      return 'unknown';
    }
  }
  
  return 'unknown';
}

/**
 * Create a standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} error - User-friendly error message
 * @param {string} errorCode - Machine-readable error code
 * @param {boolean} retryable - Whether the client should retry
 * @param {string} workflowId - Optional workflow ID
 * @param {Object} event - Lambda event object for CORS
 * @returns {Object} Lambda response object
 */
function errorResponse(statusCode, error, errorCode = 'UNKNOWN_ERROR', retryable = false, workflowId = null, event = null) {
  const response = {
    statusCode,
    headers: { 
      "Content-Type": "application/json",
      ...getCorsHeaders(event)
    },
    body: JSON.stringify({
      error,
      errorCode,
      retryable,
      ...(workflowId && { workflowId })
    }),
  };
  
  // Use structured error logging
  logInternalError(
    new Error(error),
    'errorResponse',
    {
      workflowId,
      statusCode,
      errorCode,
      retryable
    }
  );
  
  return response;
}

/**
 * Create a standardized success response
 * @param {Object} data - Response data
 * @param {Object} event - Lambda event object for CORS
 * @returns {Object} Lambda response object
 */
function successResponse(data, event = null) {
  return {
    statusCode: 200,
    headers: { 
      "Content-Type": "application/json",
      ...getCorsHeaders(event)
    },
    body: JSON.stringify(data),
  };
}

/**
 * Handle generate-presigned-url requests
 * @param {Object} body - Request body
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} Lambda response
 */
async function handlePresignedUrl(body, event) {
  try {
    // Validate required fields
    if (!body.fileName || !body.fileType) {
      logValidationError(
        'Missing required fields: fileName and fileType',
        'handlePresignedUrl',
        { providedFields: Object.keys(body) }
      );
      
      return errorResponse(
        400,
        'Missing required fields: fileName and fileType',
        'MISSING_FIELDS',
        false,
        null,
        event
      );
    }
    
    // Generate pre-signed URL
    const result = await generatePresignedUrl(body.fileName, body.fileType);
    
    logInfo('Pre-signed URL generated successfully', 'handlePresignedUrl', {
      workflowId: result.workflowId,
      fileName: body.fileName
    });
    
    return successResponse(result, event);
  } catch (err) {
    // Handle specific error types
    if (err.code === 'INVALID_FILE_TYPE') {
      logValidationError(err.message, 'handlePresignedUrl', {
        fileType: body.fileType
      });
      
      return errorResponse(
        400,
        err.message,
        'INVALID_FILE_TYPE',
        false,
        null,
        event
      );
    }
    
    // Generic error
    logInternalError(err, 'handlePresignedUrl', {
      fileName: body.fileName,
      fileType: body.fileType
    });
    
    return errorResponse(
      500,
      'Failed to generate pre-signed URL',
      'PRESIGNED_URL_ERROR',
      true,
      null,
      event
    );
  }
}

/**
 * Handle S3 trigger events
 * @param {Object} event - S3 event object
 * @returns {Promise<Object>} Lambda response
 */
async function handleS3Trigger(event) {
  try {
    const result = await handleS3Event(event);
    
    logInfo('S3 event processed successfully', 'handleS3Trigger', {
      workflowId: result.workflowId,
      status: result.status,
      textractJobId: result.textractJobId
    });
    
    // S3 triggers don't need HTTP responses, but return success for logging
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'S3 event processed successfully',
        workflowId: result.workflowId,
        status: result.status
      })
    };
  } catch (err) {
    logInternalError(err, 'handleS3Trigger', {
      eventRecords: event.Records?.length || 0
    });
    
    // Log error but don't fail the Lambda (S3 will retry automatically)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process S3 event',
        message: err.message
      })
    };
  }
}

/**
 * Handle get-status requests
 * @param {Object} body - Request body
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} Lambda response
 */
async function handleGetStatus(body, event) {
  const { getWorkflowState } = require('./workflowStateManager');
  
  try {
    // Validate required fields
    if (!body.workflowId) {
      logValidationError(
        'Missing required field: workflowId',
        'handleGetStatus'
      );
      
      return errorResponse(
        400,
        'Missing required field: workflowId',
        'MISSING_WORKFLOW_ID',
        false,
        null,
        event
      );
    }
    
    // Retrieve workflow state from DynamoDB
    const workflowState = await getWorkflowState(body.workflowId);
    
    // Handle workflow not found
    if (!workflowState) {
      logValidationError(
        'Workflow not found',
        'handleGetStatus',
        { workflowId: body.workflowId }
      );
      
      return errorResponse(
        404,
        'Workflow not found',
        'WORKFLOW_NOT_FOUND',
        false,
        body.workflowId,
        event
      );
    }
    
    // Return current status and timestamp
    return successResponse({
      workflowId: workflowState.workflowId,
      status: workflowState.status,
      updatedAt: workflowState.updatedAt
    }, event);
  } catch (err) {
    logInternalError(err, 'handleGetStatus', {
      workflowId: body.workflowId
    });
    
    // Generic error
    return errorResponse(
      500,
      'Failed to retrieve workflow status',
      'GET_STATUS_ERROR',
      true,
      body.workflowId,
      event
    );
  }
}

/**
 * Handle get-results requests
 * @param {Object} body - Request body
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} Lambda response
 */
async function handleGetResults(body, event) {
  const { getWorkflowState, storeResults } = require('./workflowStateManager');
  const { getTextractResults } = require('./textractOrchestrator');
  
  try {
    // Validate required fields
    if (!body.workflowId) {
      logValidationError(
        'Missing required field: workflowId',
        'handleGetResults'
      );
      
      return errorResponse(
        400,
        'Missing required field: workflowId',
        'MISSING_WORKFLOW_ID',
        false,
        null,
        event
      );
    }
    
    // Retrieve workflow state from DynamoDB
    const workflowState = await getWorkflowState(body.workflowId);
    
    // Handle workflow not found
    if (!workflowState) {
      logValidationError(
        'Workflow not found',
        'handleGetResults',
        { workflowId: body.workflowId }
      );
      
      return errorResponse(
        404,
        'Workflow not found',
        'WORKFLOW_NOT_FOUND',
        false,
        body.workflowId,
        event
      );
    }
    
    // If workflow failed, return error details
    if (workflowState.status === 'failed') {
      return successResponse({
        workflowId: workflowState.workflowId,
        status: 'failed',
        errorMessage: workflowState.errorMessage || 'Processing failed'
      }, event);
    }
    
    // If workflow is completed and results are already stored, return them
    if (workflowState.status === 'completed' && workflowState.extractedText) {
      return successResponse({
        workflowId: workflowState.workflowId,
        status: 'completed',
        extractedText: workflowState.extractedText,
        confidence: workflowState.confidence
      }, event);
    }
    
    // If workflow is still processing, check Textract job status
    if (workflowState.status === 'processing' && workflowState.textractJobId) {
      try {
        const textractResult = await getTextractResults(workflowState.textractJobId);
        
        // If Textract job is still in progress, return processing status
        if (textractResult.status === 'IN_PROGRESS') {
          return successResponse({
            workflowId: workflowState.workflowId,
            status: 'processing'
          }, event);
        }
        
        // If Textract job succeeded, store results and return them
        if (textractResult.status === 'SUCCEEDED') {
          // Store results in workflow state
          await storeResults(
            workflowState.workflowId,
            textractResult.text,
            textractResult.confidence
          );
          
          logInfo('Textract results retrieved and stored', 'handleGetResults', {
            workflowId: workflowState.workflowId,
            textLength: textractResult.text.length,
            confidence: textractResult.confidence
          });
          
          return successResponse({
            workflowId: workflowState.workflowId,
            status: 'completed',
            extractedText: textractResult.text,
            confidence: textractResult.confidence
          }, event);
        }
      } catch (textractErr) {
        // Textract job failed - update workflow status
        const { updateWorkflowStatus } = require('./workflowStateManager');
        await updateWorkflowStatus(
          workflowState.workflowId,
          'failed',
          { errorMessage: textractErr.message }
        );
        
        logInternalError(textractErr, 'handleGetResults', {
          workflowId: workflowState.workflowId,
          textractJobId: workflowState.textractJobId
        });
        
        return successResponse({
          workflowId: workflowState.workflowId,
          status: 'failed',
          errorMessage: textractErr.message
        }, event);
      }
    }
    
    // If workflow is in an unexpected state, return current status
    return successResponse({
      workflowId: workflowState.workflowId,
      status: workflowState.status
    }, event);
  } catch (err) {
    logInternalError(err, 'handleGetResults', {
      workflowId: body.workflowId
    });
    
    // Generic error
    return errorResponse(
      500,
      'Failed to retrieve workflow results',
      'GET_RESULTS_ERROR',
      true,
      body.workflowId,
      event
    );
  }
}

/**
 * Main Lambda handler with error handling wrapper
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} Lambda response
 */
exports.handler = async (event) => {
  logInfo('Lambda invoked', 'handler', {
    httpMethod: event.httpMethod,
    hasRecords: !!event.Records,
    requestContext: event.requestContext?.http?.method || event.httpMethod
  });
  
  try {
    // Handle OPTIONS requests for CORS (check both httpMethod and requestContext)
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: ''
      };
    }
    
    const requestType = determineRequestType(event);
    logInfo('Request type determined', 'handler', { requestType });
    
    switch (requestType) {
      case 'generate-presigned-url':
        const presignedBody = JSON.parse(event.body);
        return await handlePresignedUrl(presignedBody, event);
        
      case 's3-trigger':
        return await handleS3Trigger(event);
        
      case 'get-status':
        const statusBody = JSON.parse(event.body);
        return await handleGetStatus(statusBody, event);
        
      case 'get-results':
        const resultsBody = JSON.parse(event.body);
        return await handleGetResults(resultsBody, event);
        
      default:
        logValidationError(
          'Invalid request type',
          'handler',
          { requestType }
        );
        
        return errorResponse(
          400, 
          'Invalid request type. Use "generate-presigned-url", "get-status", or "get-results"',
          'INVALID_REQUEST_TYPE',
          false,
          null,
          event
        );
    }
  } catch (err) {
    logInternalError(err, 'handler', {
      eventType: event.Records ? 's3-event' : 'api-request',
      httpMethod: event.httpMethod
    });
    
    // Return user-friendly error
    return errorResponse(
      500,
      'Internal server error',
      'INTERNAL_ERROR',
      true,
      null,
      event
    );
  }
};
