const { handler } = require('./index');
const { getWorkflowState, storeResults, updateWorkflowStatus } = require('./workflowStateManager');
const { getTextractResults } = require('./textractOrchestrator');
const { generatePresignedUrl } = require('./presignedUrlGenerator');
const { handleS3Event } = require('./s3EventHandler');

// Mock the workflowStateManager module
jest.mock('./workflowStateManager');

// Mock the textractOrchestrator module
jest.mock('./textractOrchestrator');

// Mock other modules to prevent actual AWS calls
jest.mock('./presignedUrlGenerator');
jest.mock('./s3EventHandler');

describe('Lambda Handler - Request Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  it('should handle OPTIONS requests for CORS preflight', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: {
        origin: 'https://enjoylearningchess.com'
      }
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://enjoylearningchess.com');
    expect(response.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    expect(response.headers['Access-Control-Allow-Methods']).toBe('POST, GET, OPTIONS');
    expect(response.body).toBe('');
  });
  
  it('should return 400 for unknown request type', async () => {
    const event = {
      body: JSON.stringify({
        type: 'invalid-type'
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid request type');
    expect(body.errorCode).toBe('INVALID_REQUEST_TYPE');
    expect(body.retryable).toBe(false);
  });
  
  it('should return 400 for malformed JSON body', async () => {
    const event = {
      body: 'not valid json'
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.errorCode).toBe('INVALID_REQUEST_TYPE');
  });
  
  it('should return 500 for unexpected errors', async () => {
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      })
    };
    
    generatePresignedUrl.mockRejectedValue(new Error('Unexpected error'));
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Failed to generate pre-signed URL');
    expect(body.retryable).toBe(true);
  });
});

describe('Lambda Handler - Generate Presigned URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  it('should generate presigned URL successfully', async () => {
    const mockResult = {
      presignedUrl: 'https://s3.amazonaws.com/bucket/key?signature=xyz',
      workflowId: 'test-workflow-123',
      key: 'notation-uploads/test-workflow-123/1234567890-test.jpg',
      expiresIn: 300
    };
    
    generatePresignedUrl.mockResolvedValue(mockResult);
    
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(generatePresignedUrl).toHaveBeenCalledWith('test.jpg', 'image/jpeg');
    
    const body = JSON.parse(response.body);
    expect(body.presignedUrl).toBe(mockResult.presignedUrl);
    expect(body.workflowId).toBe(mockResult.workflowId);
    expect(body.key).toBe(mockResult.key);
    expect(body.expiresIn).toBe(300);
  });
  
  it('should return 400 when fileName is missing', async () => {
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileType: 'image/jpeg'
        // Missing fileName
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(400);
    expect(generatePresignedUrl).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Missing required fields: fileName and fileType');
    expect(body.errorCode).toBe('MISSING_FIELDS');
    expect(body.retryable).toBe(false);
  });
  
  it('should return 400 when fileType is missing', async () => {
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'test.jpg'
        // Missing fileType
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(400);
    expect(generatePresignedUrl).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Missing required fields: fileName and fileType');
    expect(body.errorCode).toBe('MISSING_FIELDS');
    expect(body.retryable).toBe(false);
  });
  
  it('should return 400 for invalid file type', async () => {
    const invalidTypeError = new Error('Invalid file type: application/pdf. Allowed types: image/jpeg, image/png, image/heic, image/webp');
    invalidTypeError.code = 'INVALID_FILE_TYPE';
    
    generatePresignedUrl.mockRejectedValue(invalidTypeError);
    
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'document.pdf',
        fileType: 'application/pdf'
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(400);
    expect(generatePresignedUrl).toHaveBeenCalledWith('document.pdf', 'application/pdf');
    
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid file type');
    expect(body.errorCode).toBe('INVALID_FILE_TYPE');
    expect(body.retryable).toBe(false);
  });
  
  it('should return 500 when S3 operation fails', async () => {
    generatePresignedUrl.mockRejectedValue(new Error('S3 service unavailable'));
    
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      })
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(500);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Failed to generate pre-signed URL');
    expect(body.errorCode).toBe('PRESIGNED_URL_ERROR');
    expect(body.retryable).toBe(true);
  });
  
  it('should include CORS headers in response', async () => {
    const mockResult = {
      presignedUrl: 'https://s3.amazonaws.com/bucket/key',
      workflowId: 'test-workflow-123',
      key: 'notation-uploads/test-workflow-123/test.jpg',
      expiresIn: 300
    };
    
    generatePresignedUrl.mockResolvedValue(mockResult);
    
    const event = {
      body: JSON.stringify({
        type: 'generate-presigned-url',
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      })
    };
    
    const response = await handler(event);
    
    expect(response.headers).toBeDefined();
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://enjoylearningchess.com');
    expect(response.headers['Content-Type']).toBe('application/json');
  });
});

describe('Lambda Handler - S3 Trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  it('should process S3 event successfully', async () => {
    const mockResult = {
      workflowId: 'test-workflow-123',
      status: 'processing',
      bucket: 'chess-notation-uploads',
      key: 'notation-uploads/test-workflow-123/1234567890-test.jpg',
      textractJobId: 'textract-job-456'
    };
    
    handleS3Event.mockResolvedValue(mockResult);
    
    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'chess-notation-uploads'
            },
            object: {
              key: 'notation-uploads/test-workflow-123/1234567890-test.jpg'
            }
          }
        }
      ]
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(handleS3Event).toHaveBeenCalledWith(event);
    
    const body = JSON.parse(response.body);
    expect(body.message).toBe('S3 event processed successfully');
    expect(body.workflowId).toBe('test-workflow-123');
    expect(body.status).toBe('processing');
  });
  
  it('should handle S3 event processing failure gracefully', async () => {
    handleS3Event.mockRejectedValue(new Error('Failed to start Textract job'));
    
    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'chess-notation-uploads'
            },
            object: {
              key: 'notation-uploads/test-workflow-123/test.jpg'
            }
          }
        }
      ]
    };
    
    const response = await handler(event);
    
    // S3 triggers should not fail the Lambda (S3 will retry)
    expect(response.statusCode).toBe(500);
    expect(handleS3Event).toHaveBeenCalledWith(event);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Failed to process S3 event');
    expect(body.message).toBe('Failed to start Textract job');
  });
  
  it('should handle invalid S3 event structure', async () => {
    handleS3Event.mockRejectedValue(new Error('Invalid S3 event: no records found'));
    
    const event = {
      Records: []
    };
    
    const response = await handler(event);
    
    // Empty Records array is treated as unknown request type, returns 400
    expect(response.statusCode).toBe(400);
    expect(handleS3Event).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.errorCode).toBe('INVALID_REQUEST_TYPE');
  });
  
  it('should handle workflow ID extraction failure', async () => {
    handleS3Event.mockRejectedValue(new Error('Invalid S3 key format'));
    
    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'chess-notation-uploads'
            },
            object: {
              key: 'invalid-key-format.jpg'
            }
          }
        }
      ]
    };
    
    const response = await handler(event);
    
    expect(response.statusCode).toBe(500);
    expect(handleS3Event).toHaveBeenCalledWith(event);
  });
});

describe('Lambda Handler - Get Status', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  describe('handleGetStatus', () => {
    it('should return workflow status successfully', async () => {
      const workflowId = 'test-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'processing',
        createdAt: 1234567890000,
        updatedAt: 1234567900000,
        s3Key: 'uploads/test.jpg',
        s3Bucket: 'test-bucket'
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('processing');
      expect(body.updatedAt).toBe(1234567900000);
      
      // Should not include other fields like s3Key, s3Bucket
      expect(body.s3Key).toBeUndefined();
      expect(body.s3Bucket).toBeUndefined();
    });
    
    it('should return 404 when workflow not found', async () => {
      const workflowId = 'nonexistent-workflow';
      
      getWorkflowState.mockResolvedValue(null);
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(404);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Workflow not found');
      expect(body.errorCode).toBe('WORKFLOW_NOT_FOUND');
      expect(body.workflowId).toBe(workflowId);
      expect(body.retryable).toBe(false);
    });
    
    it('should return 400 when workflowId is missing', async () => {
      const event = {
        body: JSON.stringify({
          type: 'get-status'
          // Missing workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      expect(getWorkflowState).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required field: workflowId');
      expect(body.errorCode).toBe('MISSING_WORKFLOW_ID');
      expect(body.retryable).toBe(false);
    });
    
    it('should return 500 when DynamoDB operation fails', async () => {
      const workflowId = 'test-workflow-123';
      
      getWorkflowState.mockRejectedValue(new Error('DynamoDB error'));
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to retrieve workflow status');
      expect(body.errorCode).toBe('GET_STATUS_ERROR');
      expect(body.workflowId).toBe(workflowId);
      expect(body.retryable).toBe(true);
    });
    
    it('should return status for completed workflow', async () => {
      const workflowId = 'completed-workflow';
      const mockWorkflowState = {
        workflowId,
        status: 'completed',
        createdAt: 1234567890000,
        updatedAt: 1234567950000,
        extractedText: 'e4 e5 Nf3 Nc6',
        confidence: 95.5
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('completed');
      expect(body.updatedAt).toBe(1234567950000);
      
      // get-status should not return extracted text or confidence
      expect(body.extractedText).toBeUndefined();
      expect(body.confidence).toBeUndefined();
    });
    
    it('should return status for failed workflow', async () => {
      const workflowId = 'failed-workflow';
      const mockWorkflowState = {
        workflowId,
        status: 'failed',
        createdAt: 1234567890000,
        updatedAt: 1234567920000,
        errorMessage: 'Textract processing failed'
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('failed');
      expect(body.updatedAt).toBe(1234567920000);
      
      // get-status should not return error message (use get-results for that)
      expect(body.errorMessage).toBeUndefined();
    });
    
    it('should include CORS headers in response', async () => {
      const workflowId = 'test-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'processing',
        updatedAt: Date.now()
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-status',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.headers).toBeDefined();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://enjoylearningchess.com');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });
});

describe('Lambda Handler - Get Results', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  describe('handleGetResults', () => {
    it('should return completed results when already stored', async () => {
      const workflowId = 'completed-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'completed',
        createdAt: 1234567890000,
        updatedAt: 1234567950000,
        extractedText: 'e4 e5\nNf3 Nc6\nd4 exd4',
        confidence: 95.5
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).not.toHaveBeenCalled();
      expect(storeResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('completed');
      expect(body.extractedText).toBe('e4 e5\nNf3 Nc6\nd4 exd4');
      expect(body.confidence).toBe(95.5);
    });
    
    it('should check Textract status and return processing when still in progress', async () => {
      const workflowId = 'processing-workflow-123';
      const textractJobId = 'textract-job-456';
      const mockWorkflowState = {
        workflowId,
        status: 'processing',
        textractJobId,
        createdAt: 1234567890000,
        updatedAt: 1234567900000
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      getTextractResults.mockResolvedValue({
        status: 'IN_PROGRESS',
        text: null,
        confidence: null
      });
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).toHaveBeenCalledWith(textractJobId);
      expect(storeResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('processing');
      expect(body.extractedText).toBeUndefined();
      expect(body.confidence).toBeUndefined();
    });
    
    it('should retrieve Textract results, store them, and return when job succeeds', async () => {
      const workflowId = 'processing-workflow-123';
      const textractJobId = 'textract-job-456';
      const mockWorkflowState = {
        workflowId,
        status: 'processing',
        textractJobId,
        createdAt: 1234567890000,
        updatedAt: 1234567900000
      };
      
      const mockTextractResults = {
        status: 'SUCCEEDED',
        text: '1. e4 e5\n2. Nf3 Nc6\n3. Bb5',
        confidence: 92.3,
        blocks: [
          {
            text: '1. e4 e5',
            confidence: 93.5,
            geometry: { boundingBox: { width: 0.2, height: 0.05, left: 0.1, top: 0.1 } }
          }
        ]
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      getTextractResults.mockResolvedValue(mockTextractResults);
      storeResults.mockResolvedValue();
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).toHaveBeenCalledWith(textractJobId);
      expect(storeResults).toHaveBeenCalledWith(
        workflowId,
        mockTextractResults.text,
        mockTextractResults.confidence
      );
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('completed');
      expect(body.extractedText).toBe('1. e4 e5\n2. Nf3 Nc6\n3. Bb5');
      expect(body.confidence).toBe(92.3);
    });
    
    it('should return 404 when workflow not found', async () => {
      const workflowId = 'nonexistent-workflow';
      
      getWorkflowState.mockResolvedValue(null);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(404);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Workflow not found');
      expect(body.errorCode).toBe('WORKFLOW_NOT_FOUND');
      expect(body.workflowId).toBe(workflowId);
      expect(body.retryable).toBe(false);
    });
    
    it('should return 400 when workflowId is missing', async () => {
      const event = {
        body: JSON.stringify({
          type: 'get-results'
          // Missing workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      expect(getWorkflowState).not.toHaveBeenCalled();
      expect(getTextractResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required field: workflowId');
      expect(body.errorCode).toBe('MISSING_WORKFLOW_ID');
      expect(body.retryable).toBe(false);
    });
    
    it('should return failed status with error message when workflow failed', async () => {
      const workflowId = 'failed-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'failed',
        createdAt: 1234567890000,
        updatedAt: 1234567920000,
        errorMessage: 'Textract processing failed: Invalid image format'
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('failed');
      expect(body.errorMessage).toBe('Textract processing failed: Invalid image format');
      expect(body.extractedText).toBeUndefined();
      expect(body.confidence).toBeUndefined();
    });
    
    it('should handle Textract job failure and update workflow status', async () => {
      const workflowId = 'processing-workflow-123';
      const textractJobId = 'textract-job-456';
      const mockWorkflowState = {
        workflowId,
        status: 'processing',
        textractJobId,
        createdAt: 1234567890000,
        updatedAt: 1234567900000
      };
      
      const textractError = new Error('Textract job failed: Image quality too low');
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      getTextractResults.mockRejectedValue(textractError);
      updateWorkflowStatus.mockResolvedValue();
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).toHaveBeenCalledWith(textractJobId);
      expect(updateWorkflowStatus).toHaveBeenCalledWith(
        workflowId,
        'failed',
        { errorMessage: textractError.message }
      );
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('failed');
      expect(body.errorMessage).toBe('Textract job failed: Image quality too low');
    });
    
    it('should return 500 when DynamoDB operation fails', async () => {
      const workflowId = 'test-workflow-123';
      
      getWorkflowState.mockRejectedValue(new Error('DynamoDB connection error'));
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to retrieve workflow results');
      expect(body.errorCode).toBe('GET_RESULTS_ERROR');
      expect(body.workflowId).toBe(workflowId);
      expect(body.retryable).toBe(true);
    });
    
    it('should return current status for workflows in unexpected states', async () => {
      const workflowId = 'initiated-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'initiated',
        createdAt: 1234567890000,
        updatedAt: 1234567890000
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(getWorkflowState).toHaveBeenCalledWith(workflowId);
      expect(getTextractResults).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('initiated');
      expect(body.extractedText).toBeUndefined();
      expect(body.confidence).toBeUndefined();
    });
    
    it('should include CORS headers in response', async () => {
      const workflowId = 'test-workflow-123';
      const mockWorkflowState = {
        workflowId,
        status: 'completed',
        extractedText: 'e4 e5',
        confidence: 95.0
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.headers).toBeDefined();
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://enjoylearningchess.com');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
    
    it('should handle workflow with failed status but no error message', async () => {
      const workflowId = 'failed-workflow-no-msg';
      const mockWorkflowState = {
        workflowId,
        status: 'failed',
        createdAt: 1234567890000,
        updatedAt: 1234567920000
        // No errorMessage field
      };
      
      getWorkflowState.mockResolvedValue(mockWorkflowState);
      
      const event = {
        body: JSON.stringify({
          type: 'get-results',
          workflowId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.workflowId).toBe(workflowId);
      expect(body.status).toBe('failed');
      expect(body.errorMessage).toBe('Processing failed');
    });
  });
});
