const {
  validateFile,
  validateFileType,
  validateFileSize,
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE
} = require('./fileValidator');

describe('FileValidator', () => {
  describe('validateFileType', () => {
    test('accepts valid JPEG type', () => {
      const result = validateFileType('image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts valid PNG type', () => {
      const result = validateFileType('image/png');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts valid HEIC type', () => {
      const result = validateFileType('image/heic');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts valid WebP type', () => {
      const result = validateFileType('image/webp');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts case-insensitive MIME types', () => {
      expect(validateFileType('IMAGE/JPEG').valid).toBe(true);
      expect(validateFileType('Image/Png').valid).toBe(true);
      expect(validateFileType('IMAGE/HEIC').valid).toBe(true);
    });

    test('rejects invalid file type', () => {
      const result = validateFileType('image/gif');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects non-image MIME type', () => {
      const result = validateFileType('application/pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects empty file type', () => {
      const result = validateFileType('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type is required');
    });

    test('rejects null file type', () => {
      const result = validateFileType(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type is required');
    });

    test('rejects undefined file type', () => {
      const result = validateFileType(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type is required');
    });
  });

  describe('validateFileSize', () => {
    test('accepts file size of 0 bytes', () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts file size of 1 byte', () => {
      const result = validateFileSize(1);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts file size of 5MB', () => {
      const result = validateFileSize(5 * 1024 * 1024);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts file size exactly at 10MB limit', () => {
      const result = validateFileSize(MAX_FILE_SIZE);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('rejects file size of 10MB + 1 byte', () => {
      const result = validateFileSize(MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
      expect(result.error).toContain('10MB');
    });

    test('rejects file size of 15MB', () => {
      const result = validateFileSize(15 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    test('rejects negative file size', () => {
      const result = validateFileSize(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a non-negative number');
    });

    test('rejects null file size', () => {
      const result = validateFileSize(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size is required');
    });

    test('rejects undefined file size', () => {
      const result = validateFileSize(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size is required');
    });

    test('rejects non-numeric file size', () => {
      const result = validateFileSize('not a number');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a non-negative number');
    });
  });

  describe('validateFile', () => {
    test('accepts valid file with JPEG type and 5MB size', () => {
      const file = {
        type: 'image/jpeg',
        size: 5 * 1024 * 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts valid file with PNG type and 1MB size', () => {
      const file = {
        type: 'image/png',
        size: 1 * 1024 * 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    test('accepts valid file with HEIC type at 10MB limit', () => {
      const file = {
        type: 'image/heic',
        size: MAX_FILE_SIZE
      };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    test('accepts valid file with WebP type and 0 bytes', () => {
      const file = {
        type: 'image/webp',
        size: 0
      };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    test('rejects file with invalid type', () => {
      const file = {
        type: 'image/gif',
        size: 5 * 1024 * 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects file with size exceeding limit', () => {
      const file = {
        type: 'image/jpeg',
        size: MAX_FILE_SIZE + 1
      };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    test('rejects file with both invalid type and size', () => {
      const file = {
        type: 'application/pdf',
        size: 15 * 1024 * 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      // Should fail on type validation first
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects null file', () => {
      const result = validateFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File is required');
    });

    test('rejects undefined file', () => {
      const result = validateFile(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File is required');
    });

    test('rejects file with missing type property', () => {
      const file = {
        size: 5 * 1024 * 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type is required');
    });

    test('rejects file with missing size property', () => {
      const file = {
        type: 'image/jpeg'
      };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size is required');
    });
  });

  describe('Constants', () => {
    test('VALID_IMAGE_TYPES contains expected types', () => {
      expect(VALID_IMAGE_TYPES).toEqual([
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/webp'
      ]);
    });

    test('MAX_FILE_SIZE is 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });
});
