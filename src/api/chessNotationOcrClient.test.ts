/**
 * Unit tests for Chess Notation OCR API Client
 */

import {
  generatePresignedUrl,
  uploadToS3,
  getWorkflowStatus,
  getWorkflowResults,
  pollWorkflowUntilComplete,
  ApiError
} from './chessNotationOcrClient';

// Mock fetch globally
global.fetch = jest.fn();

// Mock XMLHttpRequest for upload tests
class MockXMLHttpRequest {
  public status = 0;
  public upload = {
    addEventListener: jest.fn()
  };
  private eventListeners: { [key: string]: Function[] } = {};
  
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  
  addEventListener(event: string, handler: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }
  
  // Helper to trigger events in tests
  triggerEvent(event: string, data?: any) {
    const handlers = this.eventListeners[event] || [];
    handlers.forEach(handler => handler(data));
  }
}

describe('chessNotationOcrClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });
  
  describe('generatePresignedUrl', () => {
    it('should successfully generate a pre-signed URL', async () => {
      const mockResponse = {
        presignedUrl: 'https://s3.amazonaws.com/bucket/key?signature=xyz',
        workflowId: 'test-workflow-123',
        key: 'notation-uploads/test-workflow-123/image.jpg',
        expiresIn: 300
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await generatePresignedUrl('image.jpg', 'image/jpeg');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'generate-presigned-url',
            fileName: 'image.jpg',
            fileType: 'image/jpeg'
          })
        })
      );
    });
    
    it('should throw ApiError for invalid file type', async () => {
      const mockErrorResponse = {
        error: 'Invalid file type',
        errorCode: 'INVALID_FILE_TYPE',
        retryable: false
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockErrorResponse
      });
      
      try {
        await generatePresignedUrl('document.pdf', 'application/pdf');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).errorCode).toBe('INVALID_FILE_TYPE');
        expect((error as ApiError).retryable).toBe(false);
      }
    });
    
    it('should retry on network errors', async () => {
      // First two attempts fail with network error
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            presignedUrl: 'https://s3.amazonaws.com/bucket/key',
            workflowId: 'test-workflow-123',
            key: 'notation-uploads/test-workflow-123/image.jpg',
            expiresIn: 300
          })
        });
      
      const result = await generatePresignedUrl('image.jpg', 'image/jpeg');
      
      expect(result.workflowId).toBe('test-workflow-123');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
    
    it('should fail after max retries', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch')
      );
      
      await expect(
        generatePresignedUrl('image.jpg', 'image/jpeg')
      ).rejects.toThrow(ApiError);
      
      expect(global.fetch).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
    });
    
    it('should not retry on non-retryable errors', async () => {
      const mockErrorResponse = {
        error: 'Missing required fields',
        errorCode: 'MISSING_FIELDS',
        retryable: false
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockErrorResponse
      });
      
      await expect(
        generatePresignedUrl('', '')
      ).rejects.toThrow(ApiError);
      
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });
  });
  
  describe('uploadToS3', () => {
    let mockXHR: MockXMLHttpRequest;
    
    beforeEach(() => {
      mockXHR = new MockXMLHttpRequest();
      (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
    });
    
    it('should successfully upload a file', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const presignedUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      
      // Simulate successful upload
      setTimeout(() => {
        mockXHR.status = 200;
        mockXHR.triggerEvent('load');
      }, 10);
      
      await uploadToS3(presignedUrl, file);
      
      expect(mockXHR.open).toHaveBeenCalledWith('PUT', presignedUrl);
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockXHR.send).toHaveBeenCalledWith(file);
    });
    
    it('should track upload progress', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const presignedUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      const onProgress = jest.fn();
      
      // Simulate progress events
      setTimeout(() => {
        const progressHandler = mockXHR.upload.addEventListener.mock.calls[0][1];
        progressHandler({ lengthComputable: true, loaded: 50, total: 100 });
        progressHandler({ lengthComputable: true, loaded: 100, total: 100 });
        
        mockXHR.status = 200;
        mockXHR.triggerEvent('load');
      }, 10);
      
      await uploadToS3(presignedUrl, file, onProgress);
      
      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(100);
    });
    
    it('should reject on upload error', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const presignedUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      
      setTimeout(() => {
        mockXHR.triggerEvent('error');
      }, 10);
      
      await expect(
        uploadToS3(presignedUrl, file)
      ).rejects.toThrow('Network error during upload');
    });
    
    it('should reject on non-2xx status', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const presignedUrl = 'https://s3.amazonaws.com/bucket/key?signature=xyz';
      
      setTimeout(() => {
        mockXHR.status = 403;
        mockXHR.triggerEvent('load');
      }, 10);
      
      await expect(
        uploadToS3(presignedUrl, file)
      ).rejects.toThrow('Upload failed with status 403');
    });
  });
  
  describe('getWorkflowStatus', () => {
    it('should successfully get workflow status', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-123',
        status: 'processing' as const,
        updatedAt: Date.now()
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await getWorkflowStatus('test-workflow-123');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'get-status',
            workflowId: 'test-workflow-123'
          })
        })
      );
    });
    
    it('should throw ApiError for workflow not found', async () => {
      const mockErrorResponse = {
        error: 'Workflow not found',
        errorCode: 'WORKFLOW_NOT_FOUND',
        retryable: false,
        workflowId: 'invalid-workflow'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockErrorResponse
      });
      
      await expect(
        getWorkflowStatus('invalid-workflow')
      ).rejects.toThrow(ApiError);
    });
  });
  
  describe('getWorkflowResults', () => {
    it('should successfully get completed workflow results', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-123',
        status: 'completed' as const,
        extractedText: '1. e4 e5 2. Nf3 Nc6',
        confidence: 0.95
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await getWorkflowResults('test-workflow-123');
      
      expect(result).toEqual(mockResponse);
      expect(result.extractedText).toBe('1. e4 e5 2. Nf3 Nc6');
    });
    
    it('should return processing status if not complete', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-123',
        status: 'processing' as const
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await getWorkflowResults('test-workflow-123');
      
      expect(result.status).toBe('processing');
      expect(result.extractedText).toBeUndefined();
    });
    
    it('should return error message for failed workflow', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-123',
        status: 'failed' as const,
        errorMessage: 'Textract processing failed'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await getWorkflowResults('test-workflow-123');
      
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Textract processing failed');
    });
  });
  
  describe('pollWorkflowUntilComplete', () => {
    it('should poll until workflow completes', async () => {
      const mockProcessingResponse = {
        workflowId: 'test-123',
        status: 'processing' as const,
        updatedAt: Date.now()
      };
      
      const mockCompletedResponse = {
        workflowId: 'test-123',
        status: 'completed' as const,
        extractedText: '1. e4 e5',
        confidence: 0.95,
        updatedAt: Date.now()
      };
      
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(async (url, options) => {
        const body = JSON.parse(options.body);
        
        if (body.type === 'get-results') {
          callCount++;
          // First two calls return processing, third returns completed
          if (callCount <= 2) {
            return {
              ok: true,
              json: async () => mockProcessingResponse
            };
          } else {
            return {
              ok: true,
              json: async () => mockCompletedResponse
            };
          }
        }
      });
      
      const onStatusUpdate = jest.fn();
      const result = await pollWorkflowUntilComplete('test-123', onStatusUpdate, 10);
      
      expect(result).toEqual(mockCompletedResponse);
      expect(onStatusUpdate).toHaveBeenCalledTimes(3);
      expect(onStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'test-123',
          status: 'processing'
        })
      );
      expect(onStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'test-123',
          status: 'completed'
        })
      );
    });
    
    it('should timeout if workflow does not complete', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          workflowId: 'test-123',
          status: 'processing' as const,
          updatedAt: Date.now()
        })
      });
      
      await expect(
        pollWorkflowUntilComplete('test-123', undefined, 10, 50)
      ).rejects.toThrow(ApiError);
      
      try {
        await pollWorkflowUntilComplete('test-123', undefined, 10, 50);
      } catch (error) {
        expect((error as ApiError).errorCode).toBe('POLLING_TIMEOUT');
      }
    });
  });
});
