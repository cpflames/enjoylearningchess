// Mock AWS SDK before requiring the module
const mockTextract = {
  startDocumentTextDetection: jest.fn(),
  getDocumentTextDetection: jest.fn()
};

jest.mock('aws-sdk', () => {
  return {
    Textract: jest.fn(() => mockTextract)
  };
});

const {
  startTextractJob,
  getTextractResults,
  parseTextractResponse
} = require('./textractOrchestrator');

describe('textractOrchestrator', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Clear console logs
    console.log = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  });
  
  describe('startTextractJob', () => {
    it('should start Textract job with correct parameters', async () => {
      const bucket = 'test-bucket';
      const key = 'notation-uploads/test-workflow-id/image.jpg';
      const jobId = 'test-job-id-123';
      
      mockTextract.startDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ JobId: jobId })
      });
      
      const result = await startTextractJob(bucket, key);
      
      expect(result).toBe(jobId);
      expect(mockTextract.startDocumentTextDetection).toHaveBeenCalledWith({
        DocumentLocation: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        }
      });
      
      // Verify structured logging was called
      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      
      // Verify the info log contains the job ID
      const infoLogs = console.info.mock.calls.map(call => JSON.parse(call[0]));
      const successLog = infoLogs.find(log => log.context === 'startTextractJob');
      expect(successLog).toBeDefined();
      expect(successLog.jobId).toBe(jobId);
    });
    
    it('should throw error if Textract job fails to start', async () => {
      const bucket = 'test-bucket';
      const key = 'notation-uploads/test-workflow-id/image.jpg';
      const error = new Error('Textract service unavailable');
      
      mockTextract.startDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(startTextractJob(bucket, key)).rejects.toThrow(
        'Failed to start Textract job: Textract service unavailable'
      );
      
      // Verify structured error logging was called
      expect(console.error).toHaveBeenCalled();
      const loggedMessage = JSON.parse(console.error.mock.calls[0][0]);
      expect(loggedMessage.category).toBe('TEXTRACT');
      expect(loggedMessage.context).toBe('startTextractJob');
      expect(loggedMessage.errorMessage).toContain('Textract service unavailable');
    });
    
    it('should handle throttling errors', async () => {
      const bucket = 'test-bucket';
      const key = 'notation-uploads/test-workflow-id/image.jpg';
      const error = new Error('ThrottlingException');
      error.code = 'ThrottlingException';
      
      mockTextract.startDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(startTextractJob(bucket, key)).rejects.toThrow(
        'Failed to start Textract job: ThrottlingException'
      );
    });
  });
  
  describe('getTextractResults', () => {
    it('should return IN_PROGRESS status when job is still processing', async () => {
      const jobId = 'test-job-id-123';
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          JobStatus: 'IN_PROGRESS'
        })
      });
      
      const result = await getTextractResults(jobId);
      
      expect(result).toEqual({
        status: 'IN_PROGRESS',
        text: null,
        confidence: null,
        blocks: null
      });
      expect(mockTextract.getDocumentTextDetection).toHaveBeenCalledWith({
        JobId: jobId
      });
    });
    
    it('should throw error when job fails', async () => {
      const jobId = 'test-job-id-123';
      const errorMessage = 'Invalid image format';
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          JobStatus: 'FAILED',
          StatusMessage: errorMessage
        })
      });
      
      await expect(getTextractResults(jobId)).rejects.toThrow(
        `Textract job failed: ${errorMessage}`
      );
      
      // Verify structured error logging was called
      expect(console.error).toHaveBeenCalled();
      const loggedMessage = JSON.parse(console.error.mock.calls[0][0]);
      expect(loggedMessage.category).toBe('TEXTRACT');
      expect(loggedMessage.context).toBe('getTextractResults');
      expect(loggedMessage.errorMessage).toContain('Invalid image format');
    });
    
    it('should parse and return results when job succeeds', async () => {
      const jobId = 'test-job-id-123';
      const mockResponse = {
        JobStatus: 'SUCCEEDED',
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. e4 e5',
            Confidence: 95.5,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.2
              }
            }
          },
          {
            BlockType: 'LINE',
            Text: '2. Nf3 Nc6',
            Confidence: 92.3,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.3
              }
            }
          },
          {
            BlockType: 'WORD',
            Text: 'e4',
            Confidence: 96.0
          }
        ]
      };
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue(mockResponse)
      });
      
      const result = await getTextractResults(jobId);
      
      expect(result.status).toBe('SUCCEEDED');
      expect(result.text).toBe('1. e4 e5\n2. Nf3 Nc6');
      expect(result.confidence).toBeCloseTo(93.9, 1);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0]).toEqual({
        text: '1. e4 e5',
        confidence: 95.5,
        geometry: {
          boundingBox: {
            width: 0.5,
            height: 0.1,
            left: 0.1,
            top: 0.2
          }
        }
      });
    });
    
    it('should handle empty Blocks array', async () => {
      const jobId = 'test-job-id-123';
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          JobStatus: 'SUCCEEDED',
          Blocks: []
        })
      });
      
      const result = await getTextractResults(jobId);
      
      expect(result.status).toBe('SUCCEEDED');
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.blocks).toEqual([]);
    });
    
    it('should throw error for unexpected job status', async () => {
      const jobId = 'test-job-id-123';
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          JobStatus: 'UNKNOWN_STATUS'
        })
      });
      
      await expect(getTextractResults(jobId)).rejects.toThrow(
        'Unexpected Textract job status: UNKNOWN_STATUS'
      );
      
      // Verify structured error logging was called
      expect(console.error).toHaveBeenCalled();
      const loggedMessage = JSON.parse(console.error.mock.calls[0][0]);
      expect(loggedMessage.category).toBe('TEXTRACT');
      expect(loggedMessage.context).toBe('getTextractResults');
    });
    
    it('should handle API errors', async () => {
      const jobId = 'test-job-id-123';
      const error = new Error('API error');
      
      mockTextract.getDocumentTextDetection.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });
      
      await expect(getTextractResults(jobId)).rejects.toThrow('API error');
      
      // Verify structured error logging was called
      expect(console.error).toHaveBeenCalled();
      const loggedMessage = JSON.parse(console.error.mock.calls[0][0]);
      expect(loggedMessage.category).toBe('TEXTRACT');
      expect(loggedMessage.context).toBe('getTextractResults');
      expect(loggedMessage.errorMessage).toBe('API error');
    });
  });
  
  describe('parseTextractResponse', () => {
    it('should parse text and confidence from LINE blocks', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Line 1',
            Confidence: 90.0,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.1
              }
            }
          },
          {
            BlockType: 'LINE',
            Text: 'Line 2',
            Confidence: 80.0,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.2
              }
            }
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('Line 1\nLine 2');
      expect(result.confidence).toBe(85.0);
      expect(result.blocks).toHaveLength(2);
    });
    
    it('should filter out non-LINE blocks', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Line text',
            Confidence: 90.0,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.1
              }
            }
          },
          {
            BlockType: 'WORD',
            Text: 'Word text',
            Confidence: 95.0
          },
          {
            BlockType: 'PAGE',
            Confidence: 100.0
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('Line text');
      expect(result.confidence).toBe(90.0);
      expect(result.blocks).toHaveLength(1);
    });
    
    it('should preserve spatial layout with geometry data', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Test text',
            Confidence: 95.0,
            Geometry: {
              BoundingBox: {
                Width: 0.6,
                Height: 0.15,
                Left: 0.2,
                Top: 0.3
              }
            }
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.blocks[0].geometry).toEqual({
        boundingBox: {
          width: 0.6,
          height: 0.15,
          left: 0.2,
          top: 0.3
        }
      });
    });
    
    it('should handle blocks without text', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Confidence: 90.0,
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.1
              }
            }
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('');
      expect(result.confidence).toBe(90.0);
      expect(result.blocks[0].text).toBe('');
    });
    
    it('should handle blocks without confidence', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Test',
            Geometry: {
              BoundingBox: {
                Width: 0.5,
                Height: 0.1,
                Left: 0.1,
                Top: 0.1
              }
            }
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('Test');
      expect(result.confidence).toBe(0);
      expect(result.blocks[0].confidence).toBe(0);
    });
    
    it('should handle blocks without geometry', () => {
      const response = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Test',
            Confidence: 90.0
          }
        ]
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('Test');
      expect(result.confidence).toBe(90.0);
      expect(result.blocks).toHaveLength(0);
    });
    
    it('should handle empty response', () => {
      const response = {
        Blocks: []
      };
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.blocks).toEqual([]);
    });
    
    it('should handle missing Blocks property', () => {
      const response = {};
      
      const result = parseTextractResponse(response);
      
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.blocks).toEqual([]);
    });
  });
});
