const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Get table name from environment variable
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'chess-notation-workflows';

// TTL duration: 30 days in seconds
const TTL_DURATION = 30 * 24 * 60 * 60;

/**
 * Create a new workflow record in DynamoDB
 * @param {string} workflowId - Unique workflow identifier (UUID v4)
 * @param {Object} metadata - Additional metadata for the workflow
 * @param {string} metadata.s3Key - S3 object key
 * @param {string} metadata.s3Bucket - S3 bucket name
 * @param {string} metadata.originalFileName - Original uploaded file name
 * @returns {Promise<void>}
 * @throws {Error} If DynamoDB operation fails
 */
async function createWorkflow(workflowId, metadata = {}) {
  const now = Date.now();
  const ttl = Math.floor(now / 1000) + TTL_DURATION; // Convert to Unix timestamp in seconds
  
  const item = {
    workflowId,
    status: 'initiated',
    createdAt: now,
    updatedAt: now,
    ttl,
    ...metadata
  };
  
  const params = {
    TableName: TABLE_NAME,
    Item: item,
    // Ensure we don't overwrite existing workflows
    ConditionExpression: 'attribute_not_exists(workflowId)'
  };
  
  try {
    await dynamodb.put(params).promise();
    console.log(`Workflow created: ${workflowId}`, item);
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      console.error(`Workflow ${workflowId} already exists`);
      throw new Error(`Workflow ${workflowId} already exists`);
    }
    console.error('Error creating workflow:', err);
    throw err;
  }
}

/**
 * Update the status of a workflow with timestamp
 * @param {string} workflowId - Workflow identifier
 * @param {string} status - New status ('initiated' | 'stored' | 'processing' | 'completed' | 'failed')
 * @param {Object} details - Additional details to store
 * @param {string} details.textractJobId - Textract job ID
 * @param {string} details.errorMessage - Error message if failed
 * @param {string} details.s3Key - S3 object key
 * @param {string} details.s3Bucket - S3 bucket name
 * @returns {Promise<void>}
 * @throws {Error} If DynamoDB operation fails
 */
async function updateWorkflowStatus(workflowId, status, details = {}) {
  const now = Date.now();
  
  // Build update expression dynamically based on provided details
  let updateExpression = 'SET #status = :status, #updatedAt = :updatedAt';
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': status,
    ':updatedAt': now
  };
  
  // Add optional fields if provided
  if (details.textractJobId) {
    updateExpression += ', #textractJobId = :textractJobId';
    expressionAttributeNames['#textractJobId'] = 'textractJobId';
    expressionAttributeValues[':textractJobId'] = details.textractJobId;
  }
  
  if (details.errorMessage) {
    updateExpression += ', #errorMessage = :errorMessage';
    expressionAttributeNames['#errorMessage'] = 'errorMessage';
    expressionAttributeValues[':errorMessage'] = details.errorMessage;
  }
  
  if (details.s3Key) {
    updateExpression += ', #s3Key = :s3Key';
    expressionAttributeNames['#s3Key'] = 's3Key';
    expressionAttributeValues[':s3Key'] = details.s3Key;
  }
  
  if (details.s3Bucket) {
    updateExpression += ', #s3Bucket = :s3Bucket';
    expressionAttributeNames['#s3Bucket'] = 's3Bucket';
    expressionAttributeValues[':s3Bucket'] = details.s3Bucket;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { workflowId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    // Ensure the workflow exists before updating
    ConditionExpression: 'attribute_exists(workflowId)',
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const result = await dynamodb.update(params).promise();
    console.log(`Workflow status updated: ${workflowId} -> ${status}`, result.Attributes);
    return result.Attributes;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      console.error(`Workflow ${workflowId} does not exist`);
      throw new Error(`Workflow ${workflowId} not found`);
    }
    console.error('Error updating workflow status:', err);
    throw err;
  }
}

/**
 * Retrieve the current state of a workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<Object|null>} Workflow state object or null if not found
 */
async function getWorkflowState(workflowId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { workflowId }
  };
  
  try {
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      console.log(`Workflow not found: ${workflowId}`);
      return null;
    }
    
    console.log(`Workflow retrieved: ${workflowId}`, result.Item);
    return result.Item;
  } catch (err) {
    console.error('Error retrieving workflow state:', err);
    throw err;
  }
}

/**
 * Store OCR results in the workflow record
 * @param {string} workflowId - Workflow identifier
 * @param {string} extractedText - Extracted text from Textract
 * @param {number} confidence - Average confidence score (0-100)
 * @returns {Promise<void>}
 * @throws {Error} If DynamoDB operation fails
 */
async function storeResults(workflowId, extractedText, confidence) {
  const now = Date.now();
  
  const params = {
    TableName: TABLE_NAME,
    Key: { workflowId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #extractedText = :extractedText, #confidence = :confidence',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#extractedText': 'extractedText',
      '#confidence': 'confidence'
    },
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':updatedAt': now,
      ':extractedText': extractedText,
      ':confidence': confidence
    },
    // Ensure the workflow exists before updating
    ConditionExpression: 'attribute_exists(workflowId)',
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const result = await dynamodb.update(params).promise();
    console.log(`Results stored for workflow: ${workflowId}`, {
      textLength: extractedText.length,
      confidence
    });
    return result.Attributes;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      console.error(`Workflow ${workflowId} does not exist`);
      throw new Error(`Workflow ${workflowId} not found`);
    }
    console.error('Error storing results:', err);
    throw err;
  }
}

module.exports = {
  createWorkflow,
  updateWorkflowStatus,
  getWorkflowState,
  storeResults
};
