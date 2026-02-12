/**
 * Unit tests for FileValidator
 * 
 * Tests file type and size validation logic
 */

import { validateFile } from './fileValidator';
import { MAX_FILE_SIZE } from '../types/chess-notation-ocr';

describe('FileValidator', () => {
  describe('validateFile', () => {
    describe('file type validation', () => {
      it('should accept JPEG files', () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept PNG files', () => {
        const file = new File(['content'], 'test.png', { type: 'image/png' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept HEIC files', () => {
        const file = new File(['content'], 'test.heic', { type: 'image/heic' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept WebP files', () => {
        const file = new File(['content'], 'test.webp', { type: 'image/webp' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject unsupported file types', () => {
        const file = new File(['content'], 'test.gif', { type: 'image/gif' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
      });

      it('should reject PDF files', () => {
        const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
      });
    });

    describe('file size validation', () => {
      it('should accept files under 10MB', () => {
        const content = new Uint8Array(5 * 1024 * 1024); // 5MB
        const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept files exactly at 10MB', () => {
        const content = new Uint8Array(MAX_FILE_SIZE); // Exactly 10MB
        const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject files over 10MB', () => {
        const content = new Uint8Array(MAX_FILE_SIZE + 1); // 10MB + 1 byte
        const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds');
        expect(result.error).toContain('10MB');
      });

      it('should reject files significantly over 10MB', () => {
        const content = new Uint8Array(15 * 1024 * 1024); // 15MB
        const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds');
      });
    });

    describe('combined validation', () => {
      it('should reject files with invalid type even if size is valid', () => {
        const content = new Uint8Array(1024); // 1KB
        const file = new File([content], 'test.txt', { type: 'text/plain' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
      });

      it('should reject files with valid type but invalid size', () => {
        const content = new Uint8Array(MAX_FILE_SIZE + 1000); // Over 10MB
        const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds');
      });

      it('should accept empty files with valid type', () => {
        const file = new File([], 'test.jpg', { type: 'image/jpeg' });
        const result = validateFile(file);
        expect(result.valid).toBe(true);
      });
    });
  });
});
