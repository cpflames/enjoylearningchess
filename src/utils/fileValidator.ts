/**
 * File Validation Utility for Chess Notation OCR
 * 
 * Validates uploaded files for:
 * - Supported file types (JPEG, PNG, HEIC, WebP)
 * - File size limits (max 10MB)
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

import { 
  ValidationResult, 
  SUPPORTED_FILE_TYPES, 
  MAX_FILE_SIZE 
} from '../types/chess-notation-ocr';

/**
 * Validate a file for upload
 * 
 * @param file - File to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateFile(file: File): ValidationResult {
  // Check file type
  if (!SUPPORTED_FILE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload a JPEG, PNG, HEIC, or WebP image.`
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit. Please upload a smaller image.`
    };
  }
  
  return { valid: true };
}
