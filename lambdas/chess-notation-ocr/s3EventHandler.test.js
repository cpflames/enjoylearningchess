const {
  parseS3Event,
  extractWorkflowId,
  calculateBackoffDelay,
  retryWithBackoff,
  handleS3Event,
  RETRY_CONFIG
} = require('./s3EventHandler');

// Mock the workflowStateManager module
jest.mock('./workflowStateManager');
const { updateWorkflowStatus } = require('./workflowStateManager');

// Mock the textractOrchestrator module
jest.mock('./textractOrchestrator');
const { startTextractJob } = require('./textractOrchestrator');

describe('S3 Event Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseS3Event', () => {
    it('should extract bucket and key from valid S3 event', () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/abc-123/1234567890-test.jpg' }
            }
          }
        ]
      };

      const result = parseS3Event(event);

      expect(result).toEqual({
        bucket: 'test-bucket',
        key: 'notation-uploads/abc-123/1234567890-test.jpg'
      });
    });

    it('should decode URL-encoded keys', () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/abc-123/file%20with%20spaces.jpg' }
            }
          }
        ]
      };

      const result = parseS3Event(event);

      expect(result.key).toBe('notation-uploads/abc-123/file with spaces.jpg');
    });

    it('should handle plus signs in keys', () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/abc-123/file+name.jpg' }
            }
          }
        ]
      };

      const result = parseS3Event(event);

      expect(result.key).toBe('notation-uploads/abc-123/file name.jpg');
    });

    it('should throw error for event with no records', () => {
      const event = { Records: [] };

      expect(() => parseS3Event(event)).toThrow('Invalid S3 event: no records found');
    });

    it('should throw error for event with missing s3 data', () => {
      const event = {
        Records: [{ eventName: 'ObjectCreated:Put' }]
      };

      expect(() => parseS3Event(event)).toThrow('Invalid S3 event: missing s3 data');
    });
  });

  describe('extractWorkflowId', () => {
    it('should extract workflow ID from valid key', () => {
      const key = 'notation-uploads/abc-123-def-456/1234567890-test.jpg';

      const workflowId = extractWorkflowId(key);

      expect(workflowId).toBe('abc-123-def-456');
    });

    it('should extract workflow ID with UUID format', () => {
      const key = 'notation-uploads/550e8400-e29b-41d4-a716-446655440000/1234567890-test.jpg';

      const workflowId = extractWorkflowId(key);

      expect(workflowId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw error for invalid key format (wrong prefix)', () => {
      const key = 'wrong-prefix/abc-123/1234567890-test.jpg';

      expect(() => extractWorkflowId(key)).toThrow('Invalid S3 key format');
    });

    it('should throw error for key with no workflow ID', () => {
      const key = 'notation-uploads/';

      expect(() => extractWorkflowId(key)).toThrow('Could not extract workflow ID from key');
    });

    it('should throw error for key with only one part', () => {
      const key = 'notation-uploads';

      expect(() => extractWorkflowId(key)).toThrow('Invalid S3 key format');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff for attempt 0', () => {
      const delay = calculateBackoffDelay(0);

      // Initial delay is 100ms, with ±25% jitter
      expect(delay).toBeGreaterThanOrEqual(75);
      expect(delay).toBeLessThanOrEqual(125);
    });

    it('should calculate exponential backoff for attempt 1', () => {
      const delay = calculateBackoffDelay(1);

      // 100 * 2^1 = 200ms, with ±25% jitter
      expect(delay).toBeGreaterThanOrEqual(150);
      expect(delay).toBeLessThanOrEqual(250);
    });

    it('should calculate exponential backoff for attempt 2', () => {
      const delay = calculateBackoffDelay(2);

      // 100 * 2^2 = 400ms, with ±25% jitter
      expect(delay).toBeGreaterThanOrEqual(300);
      expect(delay).toBeLessThanOrEqual(500);
    });

    it('should cap delay at maxDelay', () => {
      const delay = calculateBackoffDelay(10);

      // Should be capped at 3200ms, with ±25% jitter
      expect(delay).toBeGreaterThanOrEqual(2400);
      expect(delay).toBeLessThanOrEqual(4000);
    });

    it('should produce different delays due to jitter', () => {
      const delays = new Set();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateBackoffDelay(0));
      }

      // With jitter, we should get different values (very unlikely to get all same)
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 'Test operation');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on throttling error and eventually succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ThrottlingException', message: 'Throttled' })
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn, 'Test operation');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error and eventually succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ statusCode: 503, message: 'Service unavailable' })
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn, 'Test operation');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('Invalid');
      error.code = 'ValidationException';
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(mockFn, 'Test operation')).rejects.toThrow('Invalid');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Throttled');
      error.code = 'ThrottlingException';
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(mockFn, 'Test operation')).rejects.toThrow('Throttled');
      expect(mockFn).toHaveBeenCalledTimes(RETRY_CONFIG.maxAttempts);
    });

    it('should retry on ProvisionedThroughputExceededException', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ProvisionedThroughputExceededException', message: 'Exceeded' })
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(mockFn, 'Test operation');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleS3Event', () => {
    it('should successfully process S3 event, trigger Textract, and update workflow status', async () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/test-workflow-id/1234567890-test.jpg' }
            }
          }
        ]
      };

      updateWorkflowStatus
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'stored' })
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'processing' });
      
      startTextractJob.mockResolvedValue('textract-job-123');

      const result = await handleS3Event(event);

      expect(result).toEqual({
        workflowId: 'test-workflow-id',
        status: 'processing',
        bucket: 'test-bucket',
        key: 'notation-uploads/test-workflow-id/1234567890-test.jpg',
        textractJobId: 'textract-job-123'
      });

      // Verify workflow status was updated to "stored"
      expect(updateWorkflowStatus).toHaveBeenNthCalledWith(
        1,
        'test-workflow-id',
        'stored',
        {
          s3Key: 'notation-uploads/test-workflow-id/1234567890-test.jpg',
          s3Bucket: 'test-bucket'
        }
      );

      // Verify Textract job was started
      expect(startTextractJob).toHaveBeenCalledWith(
        'test-bucket',
        'notation-uploads/test-workflow-id/1234567890-test.jpg'
      );

      // Verify workflow status was updated to "processing" with job ID
      expect(updateWorkflowStatus).toHaveBeenNthCalledWith(
        2,
        'test-workflow-id',
        'processing',
        {
          textractJobId: 'textract-job-123'
        }
      );
    });

    it('should handle Textract start failure and update workflow to failed', async () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/test-workflow-id/1234567890-test.jpg' }
            }
          }
        ]
      };

      updateWorkflowStatus
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'stored' })
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'failed' });
      
      const textractError = new Error('Textract service unavailable');
      startTextractJob.mockRejectedValue(textractError);

      await expect(handleS3Event(event)).rejects.toThrow('Textract service unavailable');

      // Verify workflow status was updated to "stored"
      expect(updateWorkflowStatus).toHaveBeenNthCalledWith(
        1,
        'test-workflow-id',
        'stored',
        {
          s3Key: 'notation-uploads/test-workflow-id/1234567890-test.jpg',
          s3Bucket: 'test-bucket'
        }
      );

      // Verify Textract job was attempted
      expect(startTextractJob).toHaveBeenCalled();

      // Verify workflow status was updated to "failed" with error message
      expect(updateWorkflowStatus).toHaveBeenNthCalledWith(
        2,
        'test-workflow-id',
        'failed',
        {
          errorMessage: 'Textract job failed to start: Textract service unavailable'
        }
      );
    });

    it('should handle errors and update workflow to failed status', async () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/test-workflow-id/1234567890-test.jpg' }
            }
          }
        ]
      };

      updateWorkflowStatus
        .mockRejectedValueOnce(new Error('DynamoDB error'))
        .mockResolvedValueOnce({ status: 'failed' });

      await expect(handleS3Event(event)).rejects.toThrow('DynamoDB error');

      // Should have tried to update to failed status
      expect(updateWorkflowStatus).toHaveBeenCalledTimes(2);
      expect(updateWorkflowStatus).toHaveBeenLastCalledWith(
        'test-workflow-id',
        'failed',
        {
          errorMessage: 'S3 event processing failed: DynamoDB error'
        }
      );
    });

    it('should throw error for invalid S3 event', async () => {
      const event = { Records: [] };

      await expect(handleS3Event(event)).rejects.toThrow('Invalid S3 event: no records found');
    });

    it('should throw error for invalid key format', async () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'wrong-format/test.jpg' }
            }
          }
        ]
      };

      await expect(handleS3Event(event)).rejects.toThrow('Invalid S3 key format');
    });

    it('should retry Textract start on throttling error', async () => {
      const event = {
        Records: [
          {
            s3: {
              bucket: { name: 'test-bucket' },
              object: { key: 'notation-uploads/test-workflow-id/1234567890-test.jpg' }
            }
          }
        ]
      };

      updateWorkflowStatus
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'stored' })
        .mockResolvedValueOnce({ workflowId: 'test-workflow-id', status: 'processing' });
      
      const throttleError = new Error('Throttled');
      throttleError.code = 'ThrottlingException';
      
      startTextractJob
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce('textract-job-123');

      const result = await handleS3Event(event);

      expect(result.textractJobId).toBe('textract-job-123');
      expect(startTextractJob).toHaveBeenCalledTimes(2);
    });
  });
});
