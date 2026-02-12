/**
 * FileValidator utility module
 * Validates file type and size for chess notation image uploads
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

// Valid image MIME types
const VALID_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp'
];

// Maximum file size: 10MB in bytes
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate file type
 * @param {string} fileType - MIME type of the file
 * @returns {Object} Validation result with valid flag and optional error message
 */
function validateFileType(fileType) {
  if (!fileType) {
    return {
      valid: false,
      error: 'File type is required'
    };
  }
  
  const normalizedType = fileType.toLowerCase();
  
  if (!VALID_IMAGE_TYPES.includes(normalizedType)) {
    return {
      valid: false,
      error: `Invalid file type: ${fileType}. Allowed types: JPEG, PNG, HEIC, WebP`
    };
  }
  
  return { valid: true };
}

/**
 * Validate file size
 * @param {number} fileSize - Size of the file in bytes
 * @returns {Object} Validation result with valid flag and optional error message
 */
function validateFileSize(fileSize) {
  if (fileSize === undefined || fileSize === null) {
    return {
      valid: false,
      error: 'File size is required'
    };
  }
  
  if (typeof fileSize !== 'number' || fileSize < 0) {
    return {
      valid: false,
      error: 'File size must be a non-negative number'
    };
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed size of 10MB`
    };
  }
  
  return { valid: true };
}

/**
 * Validate file (both type and size)
 * @param {Object} file - File object with type and size properties
 * @param {string} file.type - MIME type of the file
 * @param {number} file.size - Size of the file in bytes
 * @returns {Object} Validation result with valid flag and optional error message
 */
function validateFile(file) {
  if (!file) {
    return {
      valid: false,
      error: 'File is required'
    };
  }
  
  // Validate file type first
  const typeValidation = validateFileType(file.type);
  if (!typeValidation.valid) {
    return typeValidation;
  }
  
  // Then validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }
  
  return { valid: true };
}

module.exports = {
  validateFile,
  validateFileType,
  validateFileSize,
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE
};
