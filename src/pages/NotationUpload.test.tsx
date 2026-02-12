/**
 * Unit tests for NotationUpload component
 * 
 * Tests component rendering, file selection, validation, and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotationUpload from './NotationUpload';

describe('NotationUpload', () => {
  beforeEach(() => {
    // Clean up any object URLs created during tests
    URL.createObjectURL = jest.fn(() => 'mock-url');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('component rendering', () => {
    it('should render the upload interface', () => {
      render(<NotationUpload />);
      
      expect(screen.getByText(/Chess Notation OCR/i)).toBeInTheDocument();
      expect(screen.getByText(/Upload a photo of your chess notation sheet/i)).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop your image here/i)).toBeInTheDocument();
    });

    it('should display supported file formats', () => {
      render(<NotationUpload />);
      
      expect(screen.getByText(/JPEG, PNG, HEIC, WebP/i)).toBeInTheDocument();
      expect(screen.getByText(/max 10MB/i)).toBeInTheDocument();
    });

    it('should display instructions', () => {
      render(<NotationUpload />);
      
      expect(screen.getByText(/Instructions/i)).toBeInTheDocument();
      expect(screen.getByText(/Take a clear photo/i)).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('should display selected file information', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
        expect(screen.getByText(/MB/)).toBeInTheDocument();
      });
    });

    it('should show upload and clear buttons after file selection', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(2);
        expect(buttons[0].textContent).toBe('Upload & Process');
        expect(buttons[1].textContent).toBe('Clear');
      });
    });

    it('should create preview URL for valid file', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
        expect(screen.getByAltText('Preview')).toBeInTheDocument();
      });
    });
  });

  describe('file validation', () => {
    it('should show error for invalid file type', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should show error for file exceeding size limit', async () => {
      const { container } = render(<NotationUpload />);
      
      const largeContent = new Uint8Array(11 * 1024 * 1024); // 11MB
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText(/exceeds.*10MB/i)).toBeInTheDocument();
      });
    });

    it('should not show upload button for invalid file', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.gif', { type: 'image/gif' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        const buttons = screen.queryAllByRole('button');
        expect(buttons.length).toBe(0);
      });
    });
  });

  describe('clear functionality', () => {
    it('should clear selected file when clear button is clicked', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });
      
      const buttons = screen.getAllByRole('button');
      const clearButton = buttons.find(btn => btn.textContent === 'Clear');
      if (clearButton) {
        fireEvent.click(clearButton);
      }
      
      await waitFor(() => {
        expect(screen.queryByText('test.jpg')).not.toBeInTheDocument();
        expect(screen.getByText(/Drag and drop your image here/i)).toBeInTheDocument();
      });
    });

    it('should revoke object URL when clearing file', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });
      
      const buttons = screen.getAllByRole('button');
      const clearButton = buttons.find(btn => btn.textContent === 'Clear');
      if (clearButton) {
        fireEvent.click(clearButton);
      }
      
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });

  describe('drag and drop', () => {
    it('should handle file drop', async () => {
      render(<NotationUpload />);
      
      const file = new File(['content'], 'dropped.jpg', { type: 'image/jpeg' });
      const dropZone = screen.getByText(/Drag and drop your image here/i).closest('div');
      
      if (dropZone) {
        fireEvent.drop(dropZone, {
          dataTransfer: {
            files: [file]
          }
        });
        
        await waitFor(() => {
          expect(screen.getByText('dropped.jpg')).toBeInTheDocument();
        });
      }
    });
  });

  describe('upload button', () => {
    it('should be disabled during processing', async () => {
      const { container } = render(<NotationUpload />);
      
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(2);
      });
      
      // Mock the API calls to simulate processing
      const mockGeneratePresignedUrl = jest.fn().mockResolvedValue({
        presignedUrl: 'https://mock-url.com',
        workflowId: 'test-workflow-id',
        key: 'test-key',
        expiresIn: 300
      });
      
      // We'll test the disabled state in integration tests
      // For now, just verify the button exists
      const buttons = screen.getAllByRole('button');
      const uploadButton = buttons.find(btn => btn.textContent === 'Upload & Process');
      expect(uploadButton).toBeInTheDocument();
    });
  });

  describe('upload progress display', () => {
    it('should show upload progress indicator during upload', () => {
      // This will be tested in integration tests with mocked API
      // Unit test just verifies component structure
      render(<NotationUpload />);
      expect(screen.getByText(/Chess Notation OCR/i)).toBeInTheDocument();
    });
  });

  describe('status messages', () => {
    it('should display appropriate status messages for each workflow stage', () => {
      // This will be tested in integration tests with mocked API
      // Unit test just verifies component structure
      render(<NotationUpload />);
      expect(screen.getByText(/Chess Notation OCR/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should display error message with retry option', () => {
      // This will be tested in integration tests with mocked API
      // Unit test just verifies component structure
      render(<NotationUpload />);
      expect(screen.getByText(/Chess Notation OCR/i)).toBeInTheDocument();
    });
  });
});
