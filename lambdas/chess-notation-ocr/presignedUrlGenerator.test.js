// Mock AWS SDK before requiring the module
const mockGetSignedUrlPromise = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(() => ({
      getSignedUrlPromise: mockGetSignedUrlPromise
    })),
    DynamoDB: {
      DocumentClient: jest.fn()
    }
  };
});

// Mock workflowStateManager
jest.mock('./workflowStateManager');

// Set environment variable before requiring the module
process.env.S3_BUCKET_NAME = 'test-bucket';

const { 
  generatePresignedUrl, 
  generateWorkflowId, 
  generateS3Key, 
  validateFileType,
  VALID_IMAGE_TYPES,
  PRESIGNED_URL_EXPIRATION
} = require('./presignedUrlGenerator');
const { createWorkflow } = require('./workflowStateManager');

describe('presignedUrlGenerator', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('validateFileType', () => {
    test('should accept valid JPEG type', () => {
      expect(validateFileType('image/jpeg')).toBe(true);
    });
    
    test('should accept valid PNG type', () => {
      expect(validateFileType('image/png')).toBe(true);
    });
    
    test('should accept valid HEIC type', () => {
      expect(validateFileType('image/heic')).toBe(true);
    });
    
    test('should accept valid WebP type', () => {
      expect(validateFileType('image/webp')).toBe(true);
    });
    
    test('should accept case-insensitive types', () => {
      expect(validateFileType('IMAGE/JPEG')).toBe(true);
      expect(validateFileType('Image/Png')).toBe(true);
    });
    
    test('should reject invalid file types', () => {
      expect(validateFileType('image/gif')).toBe(false);
      expect(validateFileType('application/pdf')).toBe(false);
      expect(validateFileType('text/plain')).toBe(false);
      expect(validateFileType('video/mp4')).toBe(false);
    });
  });
  
  describe('generateWorkflowId', () => {
    test('should generate a valid UUID v4', () => {
      const id = generateWorkflowId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });
    
    test('should generate unique IDs', () => {
      const id1 = generateWorkflowId();
      const id2 = generateWorkflowId();
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('generateS3Key', () => {
    test('should generate key with correct format', () => {
      const workflowId = 'test-workflow-id';
      const fileName = 'test-image.jpg';
      
      const key = generateS3Key(workflowId, fileName);
      
      expect(key).toMatch(/^notation-uploads\/test-workflow-id\/\d+-test-image\.jpg$/);
    });
    
    test('should sanitize filename with special characters', () => {
      const workflowId = 'test-workflow-id';
      const fileName = '../../../etc/passwd';
      
      const key = generateS3Key(workflowId, fileName);
      
      expect(key).toContain('.._.._.._etc_passwd');
      expect(key).not.toContain('../');
    });
    
    test('should handle filenames with spaces', () => {
      const workflowId = 'test-workflow-id';
      const fileName = 'my chess notation.jpg';
      
      const key = generateS3Key(workflowId, fileName);
      
      expect(key).toContain('my_chess_notation.jpg');
    });
    
    test('should include timestamp in key', () => {
      const workflowId = 'test-workflow-id';
      const fileName = 'test.jpg';
      
      const beforeTime = Date.now();
      const key = generateS3Key(workflowId, fileName);
      const afterTime = Date.now();
      
      // Extract timestamp from key
      const timestampMatch = key.match(/\/(\d+)-/);
      expect(timestampMatch).not.toBeNull();
      
      const timestamp = parseInt(timestampMatch[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
  
  describe('generatePresignedUrl', () => {
    test('should generate pre-signed URL successfully', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      const mockPresignedUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xyz';
      
      mockGetSignedUrlPromise.mockResolvedValue(mockPresignedUrl);
      createWorkflow.mockResolvedValue();
      
      const result = await generatePresignedUrl(fileName, fileType);
      
      expect(result).toHaveProperty('presignedUrl', mockPresignedUrl);
      expect(result).toHaveProperty('workflowId');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('expiresIn', PRESIGNED_URL_EXPIRATION);
      
      // Verify workflow ID is UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.workflowId).toMatch(uuidRegex);
      
      // Verify S3 key format
      expect(result.key).toMatch(/^notation-uploads\/[^/]+\/\d+-test-image\.jpg$/);
    });
    
    test('should call S3 with correct parameters', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockResolvedValue('https://test-url.com');
      createWorkflow.mockResolvedValue();
      
      await generatePresignedUrl(fileName, fileType);
      
      expect(mockGetSignedUrlPromise).toHaveBeenCalledWith(
        'putObject',
        expect.objectContaining({
          Bucket: 'test-bucket',
          Expires: PRESIGNED_URL_EXPIRATION,
          ContentType: fileType,
          ServerSideEncryption: 'AES256',
          Metadata: expect.objectContaining({
            'original-filename': fileName
          })
        })
      );
    });
    
    test('should set all required S3 metadata fields', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockResolvedValue('https://test-url.com');
      createWorkflow.mockResolvedValue();
      
      const beforeTime = Date.now();
      const result = await generatePresignedUrl(fileName, fileType);
      const afterTime = Date.now();
      
      // Verify S3 was called with all required metadata
      expect(mockGetSignedUrlPromise).toHaveBeenCalledWith(
        'putObject',
        expect.objectContaining({
          ServerSideEncryption: 'AES256',
          Metadata: expect.objectContaining({
            'original-filename': fileName,
            'upload-timestamp': expect.any(String),
            'workflow-id': result.workflowId
          })
        })
      );
      
      // Verify upload timestamp is within expected range
      const callArgs = mockGetSignedUrlPromise.mock.calls[0][1];
      const uploadTimestamp = parseInt(callArgs.Metadata['upload-timestamp']);
      expect(uploadTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(uploadTimestamp).toBeLessThanOrEqual(afterTime);
    });
    
    test('should create workflow record with correct metadata', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockResolvedValue('https://test-url.com');
      createWorkflow.mockResolvedValue();
      
      const result = await generatePresignedUrl(fileName, fileType);
      
      expect(createWorkflow).toHaveBeenCalledWith(
        result.workflowId,
        expect.objectContaining({
          s3Key: result.key,
          s3Bucket: 'test-bucket',
          originalFileName: fileName
        })
      );
    });
    
    test('should reject invalid file type', async () => {
      const fileName = 'test-document.pdf';
      const fileType = 'application/pdf';
      
      await expect(generatePresignedUrl(fileName, fileType))
        .rejects
        .toThrow('Invalid file type');
      
      // Should not call S3 or create workflow
      expect(mockGetSignedUrlPromise).not.toHaveBeenCalled();
      expect(createWorkflow).not.toHaveBeenCalled();
    });
    
    test('should throw error with INVALID_FILE_TYPE code for invalid types', async () => {
      const fileName = 'test.gif';
      const fileType = 'image/gif';
      
      try {
        await generatePresignedUrl(fileName, fileType);
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).toBe('INVALID_FILE_TYPE');
        expect(err.message).toContain('Invalid file type');
      }
    });
    
    test('should handle S3 errors', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockRejectedValue(new Error('S3 error'));
      
      await expect(generatePresignedUrl(fileName, fileType))
        .rejects
        .toThrow('S3 error');
    });
    
    test('should handle DynamoDB errors', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockResolvedValue('https://test-url.com');
      createWorkflow.mockRejectedValue(new Error('DynamoDB error'));
      
      await expect(generatePresignedUrl(fileName, fileType))
        .rejects
        .toThrow('DynamoDB error');
    });
    
    test('should set 5-minute expiration', async () => {
      const fileName = 'test-image.jpg';
      const fileType = 'image/jpeg';
      
      mockGetSignedUrlPromise.mockResolvedValue('https://test-url.com');
      createWorkflow.mockResolvedValue();
      
      const result = await generatePresignedUrl(fileName, fileType);
      
      expect(result.expiresIn).toBe(300); // 5 minutes = 300 seconds
      expect(mockGetSignedUrlPromise).toHaveBeenCalledWith(
        'putObject',
        expect.objectContaining({
          Expires: 300
        })
      );
    });
  });
});
