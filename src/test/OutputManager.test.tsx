import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import OutputManager from '../components/OutputManager';
import { FileProcessingResult, StructuredContent } from '../models';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

// Mock document.execCommand for fallback
document.execCommand = vi.fn();

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Blob
global.Blob = vi.fn().mockImplementation((content, options) => ({
  size: content[0].length,
  type: options?.type || 'text/plain'
}));

describe('OutputManager', () => {
  const mockStructuredContent: StructuredContent = {
    title: 'Test Document',
    sections: [
      {
        type: 'heading',
        level: 1,
        content: 'Main Heading'
      },
      {
        type: 'paragraph',
        content: 'This is a test paragraph.'
      }
    ],
    metadata: {
      processedAt: new Date(),
      processingTime: 1000,
      originalFormat: 'docx',
      warnings: [],
      errors: []
    }
  };

  const mockSuccessfulResults: FileProcessingResult[] = [
    {
      filename: 'document1.docx',
      success: true,
      output: mockStructuredContent,
      processingTime: 1500
    },
    {
      filename: 'document2.docx',
      success: true,
      output: mockStructuredContent,
      processingTime: 2000
    }
  ];

  const mockMixedResults: FileProcessingResult[] = [
    ...mockSuccessfulResults,
    {
      filename: 'document3.docx',
      success: false,
      error: 'Failed to parse document',
      processingTime: 500
    }
  ];

  const defaultProps = {
    results: mockSuccessfulResults
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DOM methods for download functionality
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {}
    };
    
    document.createElement = vi.fn().mockImplementation((tagName) => {
      if (tagName === 'a') return mockLink;
      if (tagName === 'textarea') return {
        value: '',
        select: vi.fn(),
        style: {}
      };
      return {};
    });
    
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no results provided', () => {
      render(<OutputManager results={[]} />);
      
      expect(screen.getByText('No processing results available.')).toBeInTheDocument();
    });

    it('should render output summary with correct counts', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByText('2 of 2 files processed successfully')).toBeInTheDocument();
    });

    it('should render mixed results summary correctly', () => {
      render(<OutputManager results={mockMixedResults} />);
      
      expect(screen.getByText('2 of 3 files processed successfully')).toBeInTheDocument();
    });

    it('should render format selector with all options', () => {
      render(<OutputManager {...defaultProps} />);
      
      const formatSelect = screen.getByLabelText('Output Format:');
      expect(formatSelect).toBeInTheDocument();
      
      expect(screen.getByRole('option', { name: 'Plain Text' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'HTML' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Markdown' })).toBeInTheDocument();
    });

    it('should render bulk action buttons', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Copy all converted content to clipboard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download all converted files' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear all results' })).toBeInTheDocument();
    });
  });

  describe('File List', () => {
    it('should render all files in results', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByText('document1.docx')).toBeInTheDocument();
      expect(screen.getByText('document2.docx')).toBeInTheDocument();
    });

    it('should show processing time for successful files', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByText('1500ms')).toBeInTheDocument();
      expect(screen.getByText('2000ms')).toBeInTheDocument();
    });

    it('should show error indicator for failed files', () => {
      render(<OutputManager results={mockMixedResults} />);
      
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to parse document')).toBeInTheDocument();
    });

    it('should render individual action buttons for successful files', () => {
      render(<OutputManager {...defaultProps} />);
      
      const copyButtons = screen.getAllByText('Copy');
      const downloadButtons = screen.getAllByText('Download');
      
      // Should have individual buttons for each successful file
      expect(copyButtons).toHaveLength(3); // 2 individual + 1 bulk
      expect(downloadButtons).toHaveLength(3); // 2 individual + 1 bulk
    });

    it('should not render action buttons for failed files', () => {
      const failedResult: FileProcessingResult[] = [{
        filename: 'failed.docx',
        success: false,
        error: 'Parse error',
        processingTime: 100
      }];
      
      render(<OutputManager results={failedResult} />);
      
      // Should only have disabled bulk buttons, no individual buttons
      const copyButtons = screen.getAllByText('Copy All');
      const downloadButtons = screen.getAllByText('Download All');
      
      expect(copyButtons).toHaveLength(1);
      expect(downloadButtons).toHaveLength(1);
    });
  });

  describe('Format Selection', () => {
    it('should change format when selector is changed', () => {
      render(<OutputManager {...defaultProps} />);
      
      const formatSelect = screen.getByLabelText('Output Format:');
      fireEvent.change(formatSelect, { target: { value: 'html' } });
      
      expect(formatSelect).toHaveValue('html');
    });

    it('should update content size estimates when format changes', () => {
      render(<OutputManager {...defaultProps} />);
      
      // Initial format (plaintext)
      const initialSizes = screen.getAllByText(/\d+(\.\d+)?\s*(B|KB|MB)/);
      expect(initialSizes.length).toBeGreaterThan(0);
      
      // Change format
      const formatSelect = screen.getByLabelText('Output Format:');
      fireEvent.change(formatSelect, { target: { value: 'html' } });
      
      // Should still show size estimates (may be different)
      const newSizes = screen.getAllByText(/\d+(\.\d+)?\s*(B|KB|MB)/);
      expect(newSizes.length).toBeGreaterThan(0);
    });
  });

  describe('Copy Functionality', () => {
    it('should copy all content when Copy All is clicked', async () => {
      const mockOnCopyAll = vi.fn();
      mockClipboard.writeText.mockResolvedValue(undefined);
      
      render(<OutputManager {...defaultProps} onCopyAll={mockOnCopyAll} />);
      
      const copyAllButton = screen.getByRole('button', { name: 'Copy all converted content to clipboard' });
      fireEvent.click(copyAllButton);
      
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        expect(mockOnCopyAll).toHaveBeenCalled();
      });
    });

    it('should copy individual file content when individual Copy is clicked', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);
      
      render(<OutputManager {...defaultProps} />);
      
      const copyButtons = screen.getAllByText('Copy');
      const individualCopyButton = copyButtons.find(button => 
        button.getAttribute('title') === 'Copy this file\'s content'
      );
      
      if (individualCopyButton) {
        fireEvent.click(individualCopyButton);
        
        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalled();
        });
      }
    });

    it('should use fallback copy method when clipboard API fails', async () => {
      const mockOnCopyAll = vi.fn();
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard not available'));
      
      render(<OutputManager {...defaultProps} onCopyAll={mockOnCopyAll} />);
      
      const copyAllButton = screen.getByRole('button', { name: 'Copy all converted content to clipboard' });
      fireEvent.click(copyAllButton);
      
      await waitFor(() => {
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(mockOnCopyAll).toHaveBeenCalled();
      });
    });

    it('should disable Copy All when no successful results', () => {
      const failedResults: FileProcessingResult[] = [{
        filename: 'failed.docx',
        success: false,
        error: 'Error',
        processingTime: 100
      }];
      
      render(<OutputManager results={failedResults} />);
      
      const copyAllButton = screen.getByRole('button', { name: 'Copy all converted content to clipboard' });
      expect(copyAllButton).toBeDisabled();
    });
  });

  describe('Download Functionality', () => {
    it('should call onDownloadAll when Download All is clicked', async () => {
      const mockOnDownloadAll = vi.fn();
      
      render(<OutputManager {...defaultProps} onDownloadAll={mockOnDownloadAll} />);
      
      const downloadAllButton = screen.getByRole('button', { name: 'Download all converted files' });
      fireEvent.click(downloadAllButton);
      
      await waitFor(() => {
        expect(mockOnDownloadAll).toHaveBeenCalled();
        const downloadData = mockOnDownloadAll.mock.calls[0][0];
        expect(downloadData).toHaveLength(2);
        expect(downloadData[0]).toHaveProperty('filename');
        expect(downloadData[0]).toHaveProperty('content');
        expect(downloadData[0]).toHaveProperty('format');
      });
    });

    it('should create download link for individual file download', () => {
      render(<OutputManager {...defaultProps} />);
      
      const downloadButtons = screen.getAllByText('Download');
      const individualDownloadButton = downloadButtons.find(button => 
        button.getAttribute('title') === 'Download this file'
      );
      
      if (individualDownloadButton) {
        fireEvent.click(individualDownloadButton);
        
        expect(global.URL.createObjectURL).toHaveBeenCalled();
        expect(document.createElement).toHaveBeenCalledWith('a');
      }
    });

    it('should disable Download All when no successful results', () => {
      const failedResults: FileProcessingResult[] = [{
        filename: 'failed.docx',
        success: false,
        error: 'Error',
        processingTime: 100
      }];
      
      render(<OutputManager results={failedResults} />);
      
      const downloadAllButton = screen.getByRole('button', { name: 'Download all converted files' });
      expect(downloadAllButton).toBeDisabled();
    });
  });

  describe('Clear Functionality', () => {
    it('should call onClearResults when Clear button is clicked', () => {
      const mockOnClearResults = vi.fn();
      
      render(<OutputManager {...defaultProps} onClearResults={mockOnClearResults} />);
      
      const clearButton = screen.getByRole('button', { name: 'Clear all results' });
      fireEvent.click(clearButton);
      
      expect(mockOnClearResults).toHaveBeenCalled();
    });
  });

  describe('Processing State', () => {
    it('should show processing state during bulk operations', async () => {
      const mockOnDownloadAll = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<OutputManager {...defaultProps} onDownloadAll={mockOnDownloadAll} />);
      
      const downloadAllButton = screen.getByRole('button', { name: 'Download all converted files' });
      fireEvent.click(downloadAllButton);
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(downloadAllButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByText('Download All')).toBeInTheDocument();
      });
    });
  });

  describe('File Size Estimation', () => {
    it('should display file size estimates', () => {
      render(<OutputManager {...defaultProps} />);
      
      const sizeElements = screen.getAllByText(/\d+(\.\d+)?\s*(B|KB|MB)/);
      expect(sizeElements.length).toBeGreaterThan(0);
    });

    it('should format bytes correctly', () => {
      // This is tested implicitly through the component rendering
      // The getFileSizeEstimate function handles B, KB, MB formatting
      render(<OutputManager {...defaultProps} />);
      
      // Should show some size indication
      expect(screen.getAllByText(/\d+(\.\d+)?\s*(B|KB|MB)/).length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and titles', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Copy all converted content to clipboard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download all converted files' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear all results' })).toBeInTheDocument();
    });

    it('should have proper labels for form controls', () => {
      render(<OutputManager {...defaultProps} />);
      
      expect(screen.getByLabelText('Output Format:')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<OutputManager {...defaultProps} />);
      
      const formatSelect = screen.getByLabelText('Output Format:');
      formatSelect.focus();
      expect(document.activeElement).toBe(formatSelect);
    });
  });
});