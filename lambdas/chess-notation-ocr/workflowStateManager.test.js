const AWS = require('aws-sdk');
const {
  createWorkflow,
  updateWorkflowStatus,
  getWorkflowState,
  storeResults
} = require('./workflowStateManager');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockPut = jest.fn();
  const mockUpdate = jest.fn();
  const mockGet = jest.fn();
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        put: mockPut,
        update: mockUpdate,
        get: mockGet
      }))
    }
  };
});

describe('WorkflowStateManager', () => {
  let mockDynamoDB;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Get the mocked DynamoDB instance
    mockDynamoDB = new AWS.DynamoDB.DocumentClient();
  });
  
  describe('createWorkflow', () => {
    it('should create a workflow with initial status and TTL', async () => {
      const workflowId = 'test-workflow-123';
      const metadata = {
        s3Key: 'uploads/test.jpg',
        s3Bucket: 'test-bucket',
        originalFileName: 'test.jpg'
      };
      
      mockDynamoDB.put.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });
      
      await createWorkflow(workflowId, metadata);
      
      expect(mockDynamoDB.put).toHaveBeenCalledTimes(1);
      const callArgs = mockDynamoDB.put.mock.calls[0][0];
      
      expect(callArgs.Item.workflowId).toBe(workflowId);
      expect(callArgs.Item.status).toBe('initiated');
      expect(callArgs.Item.createdAt).toBeDefined();
      expect(callArgs.Item.updatedAt).toBeDefined();
      expect(callArgs.Item.ttl).toBeDefined();
      expect(callArgs.Item.s3Key).toBe(metadata.s3Key);
      expect(callArgs.Item.s3Bucket).toBe(metadata.s3Bucket);
      expect(callArgs.Item.originalFileName).toBe(metadata.originalFileName);
      
      // Verify TTL is approximately 30 days from now (in seconds)
      const expectedTTL = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      expect(callArgs.Item.ttl).toBeGreaterThanOrEqual(expectedTTL - 5);
      expect(callArgs.Item.ttl).toBeLessThanOrEqual(expectedTTL + 5);
    });
    
    it('should throw error if workflow already exists', async () => {
      const workflowId = 'existing-workflow';
      
      const error = new Error('Conditional check failed');
      error.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.put.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(createWorkflow(workflowId)).rejects.toThrow('already exists');
    });
  });
  
  describe('updateWorkflowStatus', () => {
    it('should update workflow status with timestamp', async () => {
      const workflowId = 'test-workflow-123';
      const status = 'processing';
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Attributes: { workflowId, status, updatedAt: Date.now() }
        })
      });
      
      await updateWorkflowStatus(workflowId, status);
      
      expect(mockDynamoDB.update).toHaveBeenCalledTimes(1);
      const callArgs = mockDynamoDB.update.mock.calls[0][0];
      
      expect(callArgs.Key.workflowId).toBe(workflowId);
      expect(callArgs.ExpressionAttributeValues[':status']).toBe(status);
      expect(callArgs.ExpressionAttributeValues[':updatedAt']).toBeDefined();
    });
    
    it('should update workflow status with additional details', async () => {
      const workflowId = 'test-workflow-123';
      const status = 'processing';
      const details = {
        textractJobId: 'textract-job-456',
        s3Key: 'uploads/test.jpg',
        s3Bucket: 'test-bucket'
      };
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Attributes: { workflowId, status, ...details }
        })
      });
      
      await updateWorkflowStatus(workflowId, status, details);
      
      expect(mockDynamoDB.update).toHaveBeenCalledTimes(1);
      const callArgs = mockDynamoDB.update.mock.calls[0][0];
      
      expect(callArgs.ExpressionAttributeValues[':textractJobId']).toBe(details.textractJobId);
      expect(callArgs.ExpressionAttributeValues[':s3Key']).toBe(details.s3Key);
      expect(callArgs.ExpressionAttributeValues[':s3Bucket']).toBe(details.s3Bucket);
    });
    
    it('should update workflow status to failed with error message', async () => {
      const workflowId = 'test-workflow-123';
      const status = 'failed';
      const details = {
        errorMessage: 'Textract processing failed'
      };
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Attributes: { workflowId, status, errorMessage: details.errorMessage }
        })
      });
      
      await updateWorkflowStatus(workflowId, status, details);
      
      expect(mockDynamoDB.update).toHaveBeenCalledTimes(1);
      const callArgs = mockDynamoDB.update.mock.calls[0][0];
      
      expect(callArgs.ExpressionAttributeValues[':errorMessage']).toBe(details.errorMessage);
    });
    
    it('should throw error if workflow does not exist', async () => {
      const workflowId = 'nonexistent-workflow';
      
      const error = new Error('Conditional check failed');
      error.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(updateWorkflowStatus(workflowId, 'processing')).rejects.toThrow('not found');
    });
  });
  
  describe('getWorkflowState', () => {
    it('should retrieve workflow state', async () => {
      const workflowId = 'test-workflow-123';
      const workflowState = {
        workflowId,
        status: 'processing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        s3Key: 'uploads/test.jpg'
      };
      
      mockDynamoDB.get.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Item: workflowState })
      });
      
      const result = await getWorkflowState(workflowId);
      
      expect(mockDynamoDB.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(workflowState);
    });
    
    it('should return null if workflow not found', async () => {
      const workflowId = 'nonexistent-workflow';
      
      mockDynamoDB.get.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });
      
      const result = await getWorkflowState(workflowId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('storeResults', () => {
    it('should store OCR results and mark workflow as completed', async () => {
      const workflowId = 'test-workflow-123';
      const extractedText = 'e4 e5 Nf3 Nc6';
      const confidence = 95.5;
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Attributes: {
            workflowId,
            status: 'completed',
            extractedText,
            confidence
          }
        })
      });
      
      await storeResults(workflowId, extractedText, confidence);
      
      expect(mockDynamoDB.update).toHaveBeenCalledTimes(1);
      const callArgs = mockDynamoDB.update.mock.calls[0][0];
      
      expect(callArgs.Key.workflowId).toBe(workflowId);
      expect(callArgs.ExpressionAttributeValues[':status']).toBe('completed');
      expect(callArgs.ExpressionAttributeValues[':extractedText']).toBe(extractedText);
      expect(callArgs.ExpressionAttributeValues[':confidence']).toBe(confidence);
      expect(callArgs.ExpressionAttributeValues[':updatedAt']).toBeDefined();
    });
    
    it('should throw error if workflow does not exist', async () => {
      const workflowId = 'nonexistent-workflow';
      
      const error = new Error('Conditional check failed');
      error.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(storeResults(workflowId, 'text', 95)).rejects.toThrow('not found');
    });
  });
});
