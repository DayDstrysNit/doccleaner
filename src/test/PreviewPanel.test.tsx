import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PreviewPanel from '../components/PreviewPanel';
import { StructuredContent } from '../models';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

// Mock document.execCommand for fallback
document.execCommand = vi.fn();

describe('PreviewPanel', () => {
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
        content: 'This is a test paragraph with some content.'
      },
      {
        type: 'list',
        content: 'First list item'
      },
      {
        type: 'list',
        content: 'Second list item'
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

  const mockOriginalContent = 'Original document content with formatting';

  const defaultProps = {
    convertedContent: mockStructuredContent,
    outputFormat: 'plaintext' as const,
    showComparison: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no content provided', () => {
      render(<PreviewPanel {...defaultProps} convertedContent={undefined} />);
      
      expect(screen.getByText('No content to preview. Process a document to see the results.')).toBeInTheDocument();
    });

    it('should render preview tab by default', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Preview' })).toHaveClass('active');
      expect(screen.getByText('Converted Content (PLAINTEXT)')).toBeInTheDocument();
    });

    it('should render comparison tab when showComparison is true and original content provided', () => {
      render(
        <PreviewPanel 
          {...defaultProps} 
          showComparison={true} 
          originalContent={mockOriginalContent}
        />
      );
      
      expect(screen.getByRole('button', { name: 'Before/After' })).toBeInTheDocument();
    });

    it('should not render comparison tab when original content is not provided', () => {
      render(<PreviewPanel {...defaultProps} showComparison={true} />);
      
      expect(screen.queryByRole('button', { name: 'Before/After' })).not.toBeInTheDocument();
    });

    it('should display content statistics', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      expect(screen.getByText(/\d+ characters/)).toBeInTheDocument();
    });
  });

  describe('Format Selection', () => {
    it('should render format selector with correct options', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      const formatSelect = screen.getByLabelText('Format:');
      expect(formatSelect).toBeInTheDocument();
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'Plain Text' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'HTML' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Markdown' })).toBeInTheDocument();
    });

    it('should call onFormatChange when format is changed', () => {
      const mockOnFormatChange = vi.fn();
      render(<PreviewPanel {...defaultProps} onFormatChange={mockOnFormatChange} />);
      
      const formatSelect = screen.getByLabelText('Format:');
      fireEvent.change(formatSelect, { target: { value: 'html' } });
      
      expect(mockOnFormatChange).toHaveBeenCalledWith('html');
    });

    it('should display content in HTML format when selected', () => {
      render(<PreviewPanel {...defaultProps} outputFormat="html" />);
      
      expect(screen.getByText('Converted Content (HTML)')).toBeInTheDocument();
    });

    it('should display content in Markdown format when selected', () => {
      render(<PreviewPanel {...defaultProps} outputFormat="markdown" />);
      
      expect(screen.getByText('Converted Content (MARKDOWN)')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('should copy content to clipboard when copy button is clicked', async () => {
      const mockOnCopyContent = vi.fn();
      mockClipboard.writeText.mockResolvedValue(undefined);
      
      render(<PreviewPanel {...defaultProps} onCopyContent={mockOnCopyContent} />);
      
      const copyButton = screen.getByRole('button', { name: 'Copy' });
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        expect(mockOnCopyContent).toHaveBeenCalled();
      });
    });

    it('should use fallback copy method when clipboard API fails', async () => {
      const mockOnCopyContent = vi.fn();
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard not available'));
      
      render(<PreviewPanel {...defaultProps} onCopyContent={mockOnCopyContent} />);
      
      const copyButton = screen.getByRole('button', { name: 'Copy' });
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockOnCopyContent).toHaveBeenCalled();
      });
    });

    it('should disable copy button when no content available', () => {
      render(<PreviewPanel {...defaultProps} convertedContent={undefined} />);
      
      // Should not render copy button in empty state
      expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    });
  });

  describe('Download Functionality', () => {
    it('should call onDownloadContent when download button is clicked', () => {
      const mockOnDownloadContent = vi.fn();
      
      render(<PreviewPanel {...defaultProps} onDownloadContent={mockOnDownloadContent} />);
      
      const downloadButton = screen.getByRole('button', { name: 'Download' });
      fireEvent.click(downloadButton);
      
      expect(mockOnDownloadContent).toHaveBeenCalled();
      const [content, format] = mockOnDownloadContent.mock.calls[0];
      expect(typeof content).toBe('string');
      expect(format).toBe('plaintext');
    });

    it('should disable download button when no content available', () => {
      render(<PreviewPanel {...defaultProps} convertedContent={undefined} />);
      
      // Should not render download button in empty state
      expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to comparison tab when clicked', () => {
      render(
        <PreviewPanel 
          {...defaultProps} 
          showComparison={true} 
          originalContent={mockOriginalContent}
        />
      );
      
      const comparisonTab = screen.getByRole('button', { name: 'Before/After' });
      fireEvent.click(comparisonTab);
      
      expect(comparisonTab).toHaveClass('active');
      expect(screen.getByRole('button', { name: 'Preview' })).not.toHaveClass('active');
    });

    it('should display comparison view with original and converted content', () => {
      render(
        <PreviewPanel 
          {...defaultProps} 
          showComparison={true} 
          originalContent={mockOriginalContent}
        />
      );
      
      const comparisonTab = screen.getByRole('button', { name: 'Before/After' });
      fireEvent.click(comparisonTab);
      
      expect(screen.getByText('Original Content')).toBeInTheDocument();
      expect(screen.getByText('Converted Content')).toBeInTheDocument();
      expect(screen.getByText(mockOriginalContent.substring(0, 500))).toBeInTheDocument();
    });

    it('should switch back to preview tab when clicked', () => {
      render(
        <PreviewPanel 
          {...defaultProps} 
          showComparison={true} 
          originalContent={mockOriginalContent}
        />
      );
      
      // Switch to comparison first
      const comparisonTab = screen.getByRole('button', { name: 'Before/After' });
      fireEvent.click(comparisonTab);
      
      // Switch back to preview
      const previewTab = screen.getByRole('button', { name: 'Preview' });
      fireEvent.click(previewTab);
      
      expect(previewTab).toHaveClass('active');
      expect(comparisonTab).not.toHaveClass('active');
      expect(screen.getByText('Converted Content (PLAINTEXT)')).toBeInTheDocument();
    });
  });

  describe('Content Conversion', () => {
    it('should convert structured content to plain text format', () => {
      render(<PreviewPanel {...defaultProps} outputFormat="plaintext" />);
      
      // Should display plain text content
      const contentDisplay = screen.getByText(/Test Document/);
      expect(contentDisplay).toBeInTheDocument();
    });

    it('should convert structured content to HTML format', () => {
      render(<PreviewPanel {...defaultProps} outputFormat="html" />);
      
      // Should display HTML content (rendered)
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    it('should convert structured content to Markdown format', () => {
      render(<PreviewPanel {...defaultProps} outputFormat="markdown" />);
      
      // Should display markdown content
      expect(screen.getByText(/# Test Document/)).toBeInTheDocument();
    });
  });

  describe('Content Truncation', () => {
    it('should truncate long content in comparison view', () => {
      const longContent = 'A'.repeat(1000);
      
      render(
        <PreviewPanel 
          {...defaultProps} 
          showComparison={true} 
          originalContent={longContent}
        />
      );
      
      const comparisonTab = screen.getByRole('button', { name: 'Before/After' });
      fireEvent.click(comparisonTab);
      
      // Should show truncated content with ellipsis
      expect(screen.getByText(/A{500}\.{3}/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    });

    it('should have proper labels for form controls', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      expect(screen.getByLabelText('Format:')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<PreviewPanel {...defaultProps} />);
      
      const formatSelect = screen.getByLabelText('Format:');
      formatSelect.focus();
      expect(document.activeElement).toBe(formatSelect);
    });
  });
});