const {
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
} = require('./errorLogger');

describe('errorLogger', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleInfoSpy;
  let consoleDebugSpy;
  
  beforeEach(() => {
    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });
  
  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });
  
  describe('logError', () => {
    it('should log error with all required fields', () => {
      const error = new Error('Test error');
      const context = 'testContext';
      const workflowId = 'test-workflow-123';
      
      const result = logError({
        error,
        context,
        workflowId,
        category: ErrorCategory.INTERNAL,
        metadata: { additionalInfo: 'test' }
      });
      
      // Verify log entry structure
      expect(result).toMatchObject({
        level: LogLevel.ERROR,
        category: ErrorCategory.INTERNAL,
        context,
        errorMessage: 'Test error',
        workflowId,
        retryable: false
      });
      
      // Verify required fields are present (Requirement 6.5)
      expect(result.timestamp).toBeDefined();
      expect(result.errorCode).toBeDefined();
      expect(result.errorStack).toBeDefined();
      expect(result.additionalInfo).toBe('test');
      
      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      // Verify CloudWatch formatting (JSON string)
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(() => JSON.parse(loggedMessage)).not.toThrow();
    });
    
    it('should handle string errors', () => {
      const result = logError({
        error: 'String error message',
        context: 'testContext'
      });
      
      expect(result.errorMessage).toBe('String error message');
      expect(result.errorStack).toBeUndefined();
    });
    
    it('should include error code from Error object', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR_CODE';
      
      const result = logError({
        error,
        context: 'testContext'
      });
      
      expect(result.errorCode).toBe('TEST_ERROR_CODE');
    });
    
    it('should use error name if code is not available', () => {
      const error = new TypeError('Type error');
      
      const result = logError({
        error,
        context: 'testContext'
      });
      
      expect(result.errorCode).toBe('TypeError');
    });
    
    it('should omit workflowId if not provided', () => {
      const result = logError({
        error: 'Test error',
        context: 'testContext'
      });
      
      expect(result.workflowId).toBeUndefined();
    });
    
    it('should use correct log level', () => {
      logError({
        error: 'Test error',
        context: 'testContext',
        level: LogLevel.WARN
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    
    it('should include timestamp in ISO format', () => {
      const result = logError({
        error: 'Test error',
        context: 'testContext'
      });
      
      // Verify timestamp is valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
  
  describe('logValidationError', () => {
    it('should log validation error with correct category and level', () => {
      const result = logValidationError(
        'Invalid file type',
        'handlePresignedUrl',
        { workflowId: 'test-123' }
      );
      
      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.level).toBe(LogLevel.WARN);
      expect(result.retryable).toBe(false);
      expect(result.workflowId).toBe('test-123');
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('logNetworkError', () => {
    it('should log network error as retryable', () => {
      const error = new Error('Network timeout');
      
      const result = logNetworkError(error, 'uploadToS3');
      
      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('logS3Error', () => {
    it('should mark throttling errors as retryable', () => {
      const error = new Error('Request timeout');
      error.code = 'RequestTimeout';
      
      const result = logS3Error(error, 's3Upload');
      
      expect(result.category).toBe(ErrorCategory.S3);
      expect(result.retryable).toBe(true);
    });
    
    it('should mark 503 errors as retryable', () => {
      const error = new Error('Service unavailable');
      error.statusCode = 503;
      
      const result = logS3Error(error, 's3Upload');
      
      expect(result.retryable).toBe(true);
    });
    
    it('should mark non-retryable S3 errors correctly', () => {
      const error = new Error('Access denied');
      error.code = 'AccessDenied';
      
      const result = logS3Error(error, 's3Upload');
      
      expect(result.retryable).toBe(false);
    });
  });
  
  describe('logTextractError', () => {
    it('should mark throttling exceptions as retryable', () => {
      const error = new Error('Throttling');
      error.code = 'ThrottlingException';
      
      const result = logTextractError(error, 'startTextractJob');
      
      expect(result.category).toBe(ErrorCategory.TEXTRACT);
      expect(result.retryable).toBe(true);
    });
    
    it('should mark provisioned throughput errors as retryable', () => {
      const error = new Error('Throughput exceeded');
      error.code = 'ProvisionedThroughputExceededException';
      
      const result = logTextractError(error, 'startTextractJob');
      
      expect(result.retryable).toBe(true);
    });
    
    it('should mark invalid parameter errors as non-retryable', () => {
      const error = new Error('Invalid parameter');
      error.code = 'InvalidParameterException';
      
      const result = logTextractError(error, 'startTextractJob');
      
      expect(result.retryable).toBe(false);
    });
  });
  
  describe('logDynamoDBError', () => {
    it('should mark throughput errors as retryable', () => {
      const error = new Error('Throughput exceeded');
      error.code = 'ProvisionedThroughputExceededException';
      
      const result = logDynamoDBError(error, 'updateWorkflowStatus');
      
      expect(result.category).toBe(ErrorCategory.DYNAMODB);
      expect(result.retryable).toBe(true);
    });
    
    it('should mark request limit errors as retryable', () => {
      const error = new Error('Request limit');
      error.code = 'RequestLimitExceeded';
      
      const result = logDynamoDBError(error, 'getWorkflowState');
      
      expect(result.retryable).toBe(true);
    });
  });
  
  describe('logInternalError', () => {
    it('should log internal errors as non-retryable', () => {
      const error = new Error('Unexpected internal error');
      
      const result = logInternalError(error, 'handler');
      
      expect(result.category).toBe(ErrorCategory.INTERNAL);
      expect(result.retryable).toBe(false);
    });
  });
  
  describe('logInfo', () => {
    it('should log informational messages', () => {
      const result = logInfo(
        'Workflow created successfully',
        'createWorkflow',
        { workflowId: 'test-123' }
      );
      
      expect(result.level).toBe(LogLevel.INFO);
      expect(result.message).toBe('Workflow created successfully');
      expect(result.workflowId).toBe('test-123');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('logDebug', () => {
    it('should log debug messages', () => {
      const result = logDebug(
        'Processing S3 event',
        'handleS3Event',
        { bucket: 'test-bucket', key: 'test-key' }
      );
      
      expect(result.level).toBe(LogLevel.DEBUG);
      expect(result.message).toBe('Processing S3 event');
      expect(result.bucket).toBe('test-bucket');
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('CloudWatch formatting', () => {
    it('should format all log entries as valid JSON', () => {
      const testCases = [
        () => logError({ error: 'Test', context: 'test' }),
        () => logValidationError('Test', 'test'),
        () => logNetworkError(new Error('Test'), 'test'),
        () => logS3Error(new Error('Test'), 'test'),
        () => logTextractError(new Error('Test'), 'test'),
        () => logDynamoDBError(new Error('Test'), 'test'),
        () => logInternalError(new Error('Test'), 'test'),
        () => logInfo('Test', 'test'),
        () => logDebug('Test', 'test')
      ];
      
      testCases.forEach(testCase => {
        testCase();
      });
      
      // Get all console calls
      const allCalls = [
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
        ...consoleInfoSpy.mock.calls,
        ...consoleDebugSpy.mock.calls
      ];
      
      // Verify all are valid JSON
      allCalls.forEach(call => {
        const logMessage = call[0];
        expect(() => JSON.parse(logMessage)).not.toThrow();
      });
    });
  });
  
  describe('Error logging completeness (Requirement 6.5)', () => {
    it('should include all required fields for error logs', () => {
      const error = new Error('Test error');
      const workflowId = 'test-workflow-123';
      
      const result = logError({
        error,
        context: 'testContext',
        workflowId,
        metadata: { bucket: 'test-bucket', key: 'test-key' }
      });
      
      // Verify all required fields per Requirement 6.5:
      // - timestamp
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
      
      // - workflow ID (user identifier)
      expect(result.workflowId).toBe(workflowId);
      
      // - error details
      expect(result.errorMessage).toBeDefined();
      expect(result.errorCode).toBeDefined();
      expect(result.errorStack).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.category).toBeDefined();
      
      // - additional metadata for debugging
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toBe('test-key');
    });
  });
});
