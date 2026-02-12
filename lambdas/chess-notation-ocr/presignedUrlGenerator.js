const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const { createWorkflow } = require("./workflowStateManager");

const s3 = new AWS.S3();

// Get bucket name from environment variable
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'chess-notation-uploads';

// Pre-signed URL expiration time: 5 minutes (300 seconds)
const PRESIGNED_URL_EXPIRATION = 300;

// Valid image MIME types
const VALID_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp'
];

/**
 * Validate file type
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} True if valid, false otherwise
 */
function validateFileType(fileType) {
  return VALID_IMAGE_TYPES.includes(fileType.toLowerCase());
}

/**
 * Generate a unique workflow ID (UUID v4)
 * @returns {string} UUID v4 string
 */
function generateWorkflowId() {
  return uuidv4();
}

/**
 * Generate S3 key with timestamp and workflow ID
 * @param {string} workflowId - Unique workflow identifier
 * @param {string} fileName - Original file name
 * @returns {string} S3 object key
 */
function generateS3Key(workflowId, fileName) {
  const timestamp = Date.now();
  // Sanitize filename to prevent path traversal
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `notation-uploads/${workflowId}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Generate a pre-signed URL for S3 upload
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type of the file
 * @returns {Promise<Object>} Object containing presignedUrl, workflowId, key, and expiresIn
 * @throws {Error} If file type is invalid or S3 operation fails
 */
async function generatePresignedUrl(fileName, fileType) {
  // Validate file type
  if (!validateFileType(fileType)) {
    const error = new Error(`Invalid file type: ${fileType}. Allowed types: ${VALID_IMAGE_TYPES.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    throw error;
  }
  
  // Generate workflow ID
  const workflowId = generateWorkflowId();
  
  // Generate S3 key
  const s3Key = generateS3Key(workflowId, fileName);
  
  // Generate pre-signed URL
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Expires: PRESIGNED_URL_EXPIRATION,
    ContentType: fileType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'original-filename': fileName,
      'upload-timestamp': Date.now().toString(),
      'workflow-id': workflowId
    }
  };
  
  try {
    const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
    
    // Create initial workflow record in DynamoDB
    await createWorkflow(workflowId, {
      s3Key,
      s3Bucket: BUCKET_NAME,
      originalFileName: fileName
    });
    
    console.log(`Pre-signed URL generated for workflow: ${workflowId}`, {
      key: s3Key,
      expiresIn: PRESIGNED_URL_EXPIRATION
    });
    
    return {
      presignedUrl,
      workflowId,
      key: s3Key,
      expiresIn: PRESIGNED_URL_EXPIRATION
    };
  } catch (err) {
    console.error('Error generating pre-signed URL:', err);
    throw err;
  }
}

module.exports = {
  generatePresignedUrl,
  generateWorkflowId,
  generateS3Key,
  validateFileType,
  VALID_IMAGE_TYPES,
  PRESIGNED_URL_EXPIRATION
};
