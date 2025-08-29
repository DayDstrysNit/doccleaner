import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ProcessingStatus, { ProcessingStatusProps } from '../components/ProcessingStatus';
import { FileProcessingResult } from '../models';

describe('ProcessingStatus', () => {
  const mockSuccessfulResult: FileProcessingResult = {
    filename: 'document1.docx',
    success: true,
    processingTime: 1500,
    output: {
      title: 'Test Document',
      sections: [
        { type: 'heading', content: 'Introduction', level: 1 },
        { type: 'paragraph', content: 'This is a test document.' },
        { type: 'heading', content: 'Conclusion', level: 2 }
      ],
      metadata: {
        processedAt: new Date(),
        processingTime: 1500,
        originalFormat: 'docx',
        warnings: [],
        errors: []
      }
    }
  };

  const mockFailedResult: FileProcessingResult = {
    filename: 'corrupted.docx',
    success: false,
    error: 'File is corrupted and cannot be parsed',
    processingTime: 500
  };

  const defaultProps: ProcessingStatusProps = {
    results: [mockSuccessfulResult, mockFailedResult],
    showDetails: false
  };

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ProcessingStatus {...defaultProps} />);
      expect(screen.getByText('Processing Results')).toBeInTheDocument();
    });

    it('should not render when no results provided', () => {
      const { container } = render(<ProcessingStatus results={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should display correct summary statistics', () => {
      render(<ProcessingStatus {...defaultProps} />);
      
      expect(screen.getByText('Total Files:')).toBeInTheDocument();
      expect(screen.getByText('Successful:')).toBeInTheDocument();
      expect(screen.getByText('Failed:')).toBeInTheDocument();
      expect(screen.getByText('Avg. Time:')).toBeInTheDocument();
      
      // Check for specific values in the summary section
      const summarySection = screen.getByText('Total Files:').closest('.summary-stats');
      expect(summarySection).toBeInTheDocument();
    });

    it('should show error summary when there are failed files', () => {
      render(<ProcessingStatus {...defaultProps} />);
      
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText('1 file failed to process')).toBeInTheDocument();
    });

    it('should show plural form for multiple failed files', () => {
      const multipleFailedResults = [
        mockFailedResult,
        { ...mockFailedResult, filename: 'another-failed.docx' }
      ];
      
      render(<ProcessingStatus results={multipleFailedResults} />);
      
      expect(screen.getByText('2 files failed to process')).toBeInTheDocument();
    });

    it('should not show error summary when all files are successful', () => {
      const allSuccessfulResults = [
        mockSuccessfulResult,
        { ...mockSuccessfulResult, filename: 'document2.docx' }
      ];
      
      render(<ProcessingStatus results={allSuccessfulResults} />);
      
      expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
      expect(screen.queryByText(/failed to process/)).not.toBeInTheDocument();
    });
  });

  describe('Details Toggle', () => {
    it('should show toggle button when onToggleDetails is provided', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          {...defaultProps} 
          onToggleDetails={mockToggle}
        />
      );
      
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    it('should not show toggle button when onToggleDetails is not provided', () => {
      render(<ProcessingStatus {...defaultProps} />);
      
      expect(screen.queryByText('Show Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Hide Details')).not.toBeInTheDocument();
    });

    it('should call onToggleDetails when toggle button is clicked', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          {...defaultProps} 
          onToggleDetails={mockToggle}
        />
      );
      
      const toggleButton = screen.getByText('Show Details');
      fireEvent.click(toggleButton);
      
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('should show "Hide Details" when showDetails is true', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          {...defaultProps} 
          showDetails={true}
          onToggleDetails={mockToggle}
        />
      );
      
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes for toggle button', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          {...defaultProps} 
          onToggleDetails={mockToggle}
        />
      );
      
      const toggleButton = screen.getByLabelText('Show details');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when showDetails changes', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          {...defaultProps} 
          showDetails={true}
          onToggleDetails={mockToggle}
        />
      );
      
      const toggleButton = screen.getByLabelText('Hide details');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Details Section', () => {
    it('should show details when showDetails is true', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      expect(screen.getByText('File Processing Details')).toBeInTheDocument();
      expect(screen.getByText('document1.docx')).toBeInTheDocument();
      expect(screen.getByText('corrupted.docx')).toBeInTheDocument();
    });

    it('should not show details when showDetails is false', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={false} />);
      
      expect(screen.queryByText('File Processing Details')).not.toBeInTheDocument();
      expect(screen.queryByText('document1.docx')).not.toBeInTheDocument();
      expect(screen.queryByText('corrupted.docx')).not.toBeInTheDocument();
    });

    it('should display successful file results correctly', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      // Check for success icon and styling
      const successResults = screen.getAllByText('✓');
      expect(successResults).toHaveLength(1);
      
      // Check filename
      expect(screen.getByText('document1.docx')).toBeInTheDocument();
      
      // Check processing time
      expect(screen.getByText('1.5s')).toBeInTheDocument();
      
      // Check sections count
      expect(screen.getByText('Sections:')).toBeInTheDocument();
      expect(screen.getByText('3 sections')).toBeInTheDocument();
    });

    it('should display failed file results correctly', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      // Check for error icon
      const errorResults = screen.getAllByText('✗');
      expect(errorResults).toHaveLength(1);
      
      // Check filename
      expect(screen.getByText('corrupted.docx')).toBeInTheDocument();
      
      // Check processing time
      expect(screen.getByText('500ms')).toBeInTheDocument();
      
      // Check error message
      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('File is corrupted and cannot be parsed')).toBeInTheDocument();
    });

    it('should handle single section correctly', () => {
      const singleSectionResult: FileProcessingResult = {
        ...mockSuccessfulResult,
        output: {
          ...mockSuccessfulResult.output!,
          sections: [{ type: 'paragraph', content: 'Single section' }]
        }
      };
      
      render(<ProcessingStatus results={[singleSectionResult]} showDetails={true} />);
      
      expect(screen.getByText('1 section')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format milliseconds correctly', () => {
      const fastResult: FileProcessingResult = {
        filename: 'fast.docx',
        success: true,
        processingTime: 250,
        output: mockSuccessfulResult.output
      };
      
      render(<ProcessingStatus results={[fastResult]} showDetails={true} />);
      
      // Check that the processing time appears in the file details
      const fileResult = screen.getByText('fast.docx').closest('.file-result');
      expect(fileResult).toContainElement(screen.getAllByText('250ms')[0]);
    });

    it('should format seconds correctly', () => {
      const slowResult: FileProcessingResult = {
        filename: 'slow.docx',
        success: true,
        processingTime: 2750,
        output: mockSuccessfulResult.output
      };
      
      render(<ProcessingStatus results={[slowResult]} showDetails={true} />);
      
      // Check that the processing time appears in the file details
      const fileResult = screen.getByText('slow.docx').closest('.file-result');
      expect(fileResult).toContainElement(screen.getAllByText('2.8s')[0]);
    });

    it('should calculate average time correctly', () => {
      const results = [
        { ...mockSuccessfulResult, processingTime: 1000 },
        { ...mockFailedResult, processingTime: 2000 },
        { ...mockSuccessfulResult, filename: 'doc3.docx', processingTime: 3000 }
      ];
      
      render(<ProcessingStatus results={results} />);
      
      // Average: (1000 + 2000 + 3000) / 3 = 2000ms = 2.0s
      // Check that average time appears in the summary
      const avgTimeLabel = screen.getByText('Avg. Time:');
      const summaryItem = avgTimeLabel.closest('.stat-item');
      expect(summaryItem).toContainElement(screen.getByText('2.0s'));
    });

    it('should handle zero processing time', () => {
      const zeroTimeResult: FileProcessingResult = {
        filename: 'instant.docx',
        success: true,
        processingTime: 0,
        output: mockSuccessfulResult.output
      };
      
      render(<ProcessingStatus results={[zeroTimeResult]} showDetails={true} />);
      
      // Check that zero time appears in the file details
      const fileResult = screen.getByText('instant.docx').closest('.file-result');
      expect(fileResult).toContainElement(screen.getAllByText('0ms')[0]);
    });
  });

  describe('File Name Display', () => {
    it('should display full filename when short', () => {
      const shortNameResult: FileProcessingResult = {
        ...mockSuccessfulResult,
        filename: 'short.docx'
      };
      
      render(<ProcessingStatus results={[shortNameResult]} showDetails={true} />);
      
      expect(screen.getByText('short.docx')).toBeInTheDocument();
    });

    it('should have title attribute for accessibility', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      const filenameElement = screen.getByText('document1.docx');
      expect(filenameElement).toHaveAttribute('title', 'document1.docx');
    });
  });

  describe('Edge Cases', () => {
    it('should handle results without output', () => {
      const noOutputResult: FileProcessingResult = {
        filename: 'no-output.docx',
        success: true,
        processingTime: 1000
        // No output property
      };
      
      render(<ProcessingStatus results={[noOutputResult]} showDetails={true} />);
      
      expect(screen.getByText('no-output.docx')).toBeInTheDocument();
      // Check that processing time appears in the file details
      const fileResult = screen.getByText('no-output.docx').closest('.file-result');
      expect(fileResult).toContainElement(screen.getAllByText('1.0s')[0]);
      // Should not crash or show sections info
    });

    it('should handle results without error message', () => {
      const noErrorMessageResult: FileProcessingResult = {
        filename: 'no-error-msg.docx',
        success: false,
        processingTime: 500
        // No error property
      };
      
      render(<ProcessingStatus results={[noErrorMessageResult]} showDetails={true} />);
      
      expect(screen.getByText('no-error-msg.docx')).toBeInTheDocument();
      // Check that processing time appears in the file details
      const fileResult = screen.getByText('no-error-msg.docx').closest('.file-result');
      expect(fileResult).toContainElement(screen.getAllByText('500ms')[0]);
      // Should not show error details section
      expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });

    it('should handle empty sections array', () => {
      const emptySectionsResult: FileProcessingResult = {
        ...mockSuccessfulResult,
        output: {
          ...mockSuccessfulResult.output!,
          sections: []
        }
      };
      
      render(<ProcessingStatus results={[emptySectionsResult]} showDetails={true} />);
      
      expect(screen.getByText('0 sections')).toBeInTheDocument();
    });
  });

  describe('Styling Classes', () => {
    it('should apply correct CSS classes for successful results', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      const successResult = screen.getByText('document1.docx').closest('.file-result');
      expect(successResult).toHaveClass('status-success');
    });

    it('should apply correct CSS classes for failed results', () => {
      render(<ProcessingStatus {...defaultProps} showDetails={true} />);
      
      const errorResult = screen.getByText('corrupted.docx').closest('.file-result');
      expect(errorResult).toHaveClass('status-error');
    });
  });
});