/**
 * NotationUpload Component
 * 
 * Main page component for /notation route that handles:
 * - File selection with drag-and-drop support
 * - Image preview display
 * - File validation
 * - Upload button with validation
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { validateFile } from '../utils/fileValidator';
import { 
  generatePresignedUrl, 
  uploadToS3, 
  pollWorkflowUntilComplete,
  ApiError 
} from '../api/chessNotationOcrClient';
import type { WorkflowStatus } from '../types/chess-notation-ocr';

interface NotationUploadState {
  selectedFile: File | null;
  previewUrl: string | null;
  validationError: string | null;
  isDragging: boolean;
  uploadProgress: number;
  workflowId: string | null;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  workflowStatus: WorkflowStatus | null;
  extractedText: string | null;
  errorMessage: string | null;
  isProcessing: boolean;
}

export default function NotationUpload(): JSX.Element {
  const [state, setState] = useState<NotationUploadState>({
    selectedFile: null,
    previewUrl: null,
    validationError: null,
    isDragging: false,
    uploadProgress: 0,
    workflowId: null,
    status: 'idle',
    workflowStatus: null,
    extractedText: null,
    errorMessage: null,
    isProcessing: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection and validation
   */
  const handleFileSelect = (file: File): void => {
    // Validate the file
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setState(prev => ({
        ...prev,
        selectedFile: null,
        previewUrl: null,
        validationError: validation.error || 'Invalid file',
        isDragging: false
      }));
      return;
    }
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    setState(prev => ({
      ...prev,
      selectedFile: file,
      previewUrl,
      validationError: null,
      isDragging: false
    }));
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: true }));
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: false }));
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Trigger file input click
   */
  const handleBrowseClick = (): void => {
    fileInputRef.current?.click();
  };

  /**
   * Clear selected file
   */
  const handleClearFile = (): void => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    
    setState({
      selectedFile: null,
      previewUrl: null,
      validationError: null,
      isDragging: false,
      uploadProgress: 0,
      workflowId: null,
      status: 'idle',
      workflowStatus: null,
      extractedText: null,
      errorMessage: null,
      isProcessing: false
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle upload button click
   */
  const handleUpload = async (): Promise<void> => {
    if (!state.selectedFile) {
      return;
    }
    
    try {
      // Reset error state
      setState(prev => ({
        ...prev,
        status: 'uploading',
        uploadProgress: 0,
        errorMessage: null,
        isProcessing: true
      }));
      
      // Step 1: Get pre-signed URL
      const presignedUrlResponse = await generatePresignedUrl(
        state.selectedFile.name,
        state.selectedFile.type
      );
      
      setState(prev => ({
        ...prev,
        workflowId: presignedUrlResponse.workflowId
      }));
      
      // Step 2: Upload to S3 with progress tracking
      await uploadToS3(
        presignedUrlResponse.presignedUrl,
        state.selectedFile,
        (progress) => {
          setState(prev => ({
            ...prev,
            uploadProgress: progress
          }));
        }
      );
      
      // Step 3: Start polling for results
      setState(prev => ({
        ...prev,
        status: 'processing',
        uploadProgress: 100
      }));
      
      // Poll for workflow completion
      const results = await pollWorkflowUntilComplete(
        presignedUrlResponse.workflowId,
        (statusUpdate) => {
          setState(prev => ({
            ...prev,
            workflowStatus: statusUpdate.status
          }));
        }
      );
      
      // Step 4: Display results
      if (results.status === 'completed' && results.extractedText) {
        setState(prev => ({
          ...prev,
          status: 'completed',
          extractedText: results.extractedText || null,
          isProcessing: false
        }));
      } else if (results.status === 'failed') {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: results.errorMessage || 'OCR processing failed',
          isProcessing: false
        }));
      }
    } catch (error) {
      // Handle errors
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage,
        isProcessing: false
      }));
    }
  };
  
  /**
   * Handle retry after error
   */
  const handleRetry = (): void => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      uploadProgress: 0,
      errorMessage: null,
      workflowStatus: null,
      extractedText: null
    }));
  };

  return (
    <div className="App" style={{ textAlign: 'center', margin: '20px' }}>
      <h2>♟️ Chess Notation OCR</h2>
      <h4>Upload a photo of your chess notation sheet to digitize it</h4>

      {/* File Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: state.isDragging 
            ? '3px dashed #4CAF50' 
            : '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px',
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: state.isDragging ? '#f0f8f0' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        {!state.selectedFile ? (
          <div>
            <p style={{ fontSize: '48px', margin: '10px 0' }}>📁</p>
            <p style={{ fontSize: '18px', margin: '10px 0' }}>
              Drag and drop your image here
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: '10px 0' }}>
              or click to browse
            </p>
            <p style={{ fontSize: '12px', color: '#999', margin: '10px 0' }}>
              Supported formats: JPEG, PNG, HEIC, WebP (max 10MB)
            </p>
          </div>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: '18px', margin: '10px 0', fontWeight: 'bold' }}>
              Selected File
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
              {state.selectedFile.name}
            </p>
            <p style={{ fontSize: '12px', color: '#999', margin: '5px 0' }}>
              {(state.selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        )}
      </div>

      {/* Validation Error */}
      {state.validationError && (
        <div style={{
          color: '#d32f2f',
          backgroundColor: '#ffebee',
          padding: '12px',
          margin: '20px auto',
          maxWidth: '600px',
          borderRadius: '4px',
          border: '1px solid #ef9a9a'
        }}>
          ⚠️ {state.validationError}
        </div>
      )}

      {/* Image Preview */}
      {state.previewUrl && (
        <div style={{
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          <img
            src={state.previewUrl}
            alt="Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '400px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          />
        </div>
      )}

      {/* Upload Progress */}
      {state.status === 'uploading' && (
        <div style={{
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: '#e3f2fd',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #90caf9'
        }}>
          <h3 style={{ marginTop: 0, color: '#1976d2' }}>⬆️ Uploading...</h3>
          <div style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #90caf9'
          }}>
            <div style={{
              width: `${state.uploadProgress}%`,
              height: '100%',
              backgroundColor: '#2196f3',
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {state.uploadProgress > 10 && `${state.uploadProgress}%`}
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px', marginBottom: 0 }}>
            Uploading your image to secure storage...
          </p>
        </div>
      )}

      {/* Processing Status */}
      {state.status === 'processing' && (
        <div style={{
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: '#fff3e0',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ffb74d'
        }}>
          <h3 style={{ marginTop: 0, color: '#f57c00' }}>⚙️ Processing...</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '20px 0'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #ffb74d',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: 0 }}>
            {state.workflowStatus === 'stored' && 'Image uploaded successfully. Starting OCR processing...'}
            {state.workflowStatus === 'processing' && 'Extracting text from your notation sheet...'}
            {!state.workflowStatus && 'Processing your image...'}
          </p>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}

      {/* Success Message */}
      {state.status === 'completed' && state.extractedText && (
        <div style={{
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: '#e8f5e9',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #81c784'
        }}>
          <h3 style={{ marginTop: 0, color: '#388e3c' }}>✅ Processing Complete!</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Text has been successfully extracted from your notation sheet.
          </p>
          <div style={{
            backgroundColor: '#fff',
            padding: '15px',
            borderRadius: '4px',
            border: '1px solid #c8e6c9',
            maxHeight: '300px',
            overflowY: 'auto',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {state.extractedText}
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.status === 'error' && state.errorMessage && (
        <div style={{
          margin: '20px auto',
          maxWidth: '600px',
          backgroundColor: '#ffebee',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ef9a9a'
        }}>
          <h3 style={{ marginTop: 0, color: '#d32f2f' }}>❌ Error</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            {state.errorMessage}
          </p>
          <button
            onClick={handleRetry}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px 24px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#da190b';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f44336';
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Action Buttons */}
      {state.selectedFile && state.status !== 'completed' && (
        <div style={{ margin: '20px auto', maxWidth: '600px' }}>
          <button
            onClick={handleUpload}
            disabled={state.isProcessing}
            style={{
              backgroundColor: state.isProcessing ? '#ccc' : '#4CAF50',
              color: 'white',
              padding: '12px 32px',
              fontSize: '16px',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isProcessing ? 'not-allowed' : 'pointer',
              marginRight: '10px',
              fontWeight: 'bold',
              opacity: state.isProcessing ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!state.isProcessing) {
                e.currentTarget.style.backgroundColor = '#45a049';
              }
            }}
            onMouseOut={(e) => {
              if (!state.isProcessing) {
                e.currentTarget.style.backgroundColor = '#4CAF50';
              }
            }}
          >
            {state.isProcessing ? 'Processing...' : 'Upload & Process'}
          </button>
          
          <button
            onClick={handleClearFile}
            disabled={state.isProcessing}
            style={{
              backgroundColor: state.isProcessing ? '#ccc' : '#f44336',
              color: 'white',
              padding: '12px 32px',
              fontSize: '16px',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: state.isProcessing ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!state.isProcessing) {
                e.currentTarget.style.backgroundColor = '#da190b';
              }
            }}
            onMouseOut={(e) => {
              if (!state.isProcessing) {
                e.currentTarget.style.backgroundColor = '#f44336';
              }
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* New Upload Button (after completion) */}
      {state.status === 'completed' && (
        <div style={{ margin: '20px auto', maxWidth: '600px' }}>
          <button
            onClick={handleClearFile}
            style={{
              backgroundColor: '#2196f3',
              color: 'white',
              padding: '12px 32px',
              fontSize: '16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1976d2';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2196f3';
            }}
          >
            Upload Another Image
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        margin: '40px auto',
        maxWidth: '600px',
        textAlign: 'left',
        backgroundColor: '#e3f2fd',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginTop: 0 }}>📋 Instructions</h3>
        <ol style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '10px' }}>
            Take a clear photo of your chess notation sheet
          </li>
          <li style={{ marginBottom: '10px' }}>
            Upload the image using drag-and-drop or by clicking to browse
          </li>
          <li style={{ marginBottom: '10px' }}>
            Review the preview to ensure the image is clear
          </li>
          <li style={{ marginBottom: '10px' }}>
            Click "Upload & Process" to extract the text
          </li>
          <li style={{ marginBottom: '10px' }}>
            Wait for the OCR processing to complete
          </li>
        </ol>
      </div>
    </div>
  );
}
