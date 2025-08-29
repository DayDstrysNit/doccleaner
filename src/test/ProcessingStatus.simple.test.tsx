import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ProcessingStatus, { ProcessingStatusProps } from '../components/ProcessingStatus';
import { FileProcessingResult } from '../models';

describe('ProcessingStatus - Simple Tests', () => {
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

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} />);
      expect(screen.getByText('Processing Results')).toBeInTheDocument();
    });

    it('should not render when no results provided', () => {
      const { container } = render(<ProcessingStatus results={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should display summary statistics', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult, mockFailedResult]} />);
      
      expect(screen.getByText('Processing Results')).toBeInTheDocument();
      expect(screen.getByText('Total Files:')).toBeInTheDocument();
      expect(screen.getByText('Successful:')).toBeInTheDocument();
      expect(screen.getByText('Failed:')).toBeInTheDocument();
      expect(screen.getByText('Avg. Time:')).toBeInTheDocument();
    });

    it('should show error summary when there are failed files', () => {
      render(<ProcessingStatus results={[mockFailedResult]} />);
      
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
      render(<ProcessingStatus results={[mockSuccessfulResult]} />);
      
      expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
      expect(screen.queryByText(/failed to process/)).not.toBeInTheDocument();
    });
  });

  describe('Details Toggle', () => {
    it('should show toggle button when onToggleDetails is provided', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          results={[mockSuccessfulResult]} 
          onToggleDetails={mockToggle}
        />
      );
      
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });

    it('should not show toggle button when onToggleDetails is not provided', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} />);
      
      expect(screen.queryByText('Show Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Hide Details')).not.toBeInTheDocument();
    });

    it('should call onToggleDetails when toggle button is clicked', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          results={[mockSuccessfulResult]} 
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
          results={[mockSuccessfulResult]} 
          showDetails={true}
          onToggleDetails={mockToggle}
        />
      );
      
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });
  });

  describe('Details Section', () => {
    it('should show details when showDetails is true', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} showDetails={true} />);
      
      expect(screen.getByText('File Processing Details')).toBeInTheDocument();
      expect(screen.getByText('document1.docx')).toBeInTheDocument();
    });

    it('should not show details when showDetails is false', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} showDetails={false} />);
      
      expect(screen.queryByText('File Processing Details')).not.toBeInTheDocument();
    });

    it('should display successful file results correctly', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} showDetails={true} />);
      
      // Check for success icon
      expect(screen.getByText('✓')).toBeInTheDocument();
      
      // Check filename
      expect(screen.getByText('document1.docx')).toBeInTheDocument();
      
      // Check sections count
      expect(screen.getByText('Sections:')).toBeInTheDocument();
      expect(screen.getByText('3 sections')).toBeInTheDocument();
    });

    it('should display failed file results correctly', () => {
      render(<ProcessingStatus results={[mockFailedResult]} showDetails={true} />);
      
      // Check for error icon
      expect(screen.getByText('✗')).toBeInTheDocument();
      
      // Check filename
      expect(screen.getByText('corrupted.docx')).toBeInTheDocument();
      
      // Check error message
      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('File is corrupted and cannot be parsed')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format processing times in details', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} showDetails={true} />);
      
      // Should show formatted time in details (appears in both summary and details)
      const timeElements = screen.getAllByText('1.5s');
      expect(timeElements.length).toBeGreaterThan(0);
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
      // Should not crash or show sections info
      expect(screen.queryByText('Sections:')).not.toBeInTheDocument();
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

  describe('Accessibility', () => {
    it('should have proper accessibility attributes for toggle button', () => {
      const mockToggle = vi.fn();
      render(
        <ProcessingStatus 
          results={[mockSuccessfulResult]} 
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
          results={[mockSuccessfulResult]} 
          showDetails={true}
          onToggleDetails={mockToggle}
        />
      );
      
      const toggleButton = screen.getByLabelText('Hide details');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have title attribute for filenames', () => {
      render(<ProcessingStatus results={[mockSuccessfulResult]} showDetails={true} />);
      
      const filenameElement = screen.getByText('document1.docx');
      expect(filenameElement).toHaveAttribute('title', 'document1.docx');
    });
  });
});