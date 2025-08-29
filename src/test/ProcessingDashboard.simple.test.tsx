import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ProcessingDashboard, { ProcessingDashboardProps } from '../components/ProcessingDashboard';
import { ConcurrentBatchProcessor } from '../services/batchProcessor';
import { ProcessingProgress } from '../models';

// Simple mock batch processor
const createMockBatchProcessor = () => {
  const mockProcessor = {
    isProcessing: vi.fn(() => false),
    getProgress: vi.fn(() => ({
      currentFile: '',
      filesProcessed: 0,
      totalFiles: 0,
      percentage: 0
    })),
    cancelProcessing: vi.fn(),
    processFilePaths: vi.fn()
  } as unknown as ConcurrentBatchProcessor;

  return mockProcessor;
};

describe('ProcessingDashboard - Simple Tests', () => {
  let mockBatchProcessor: ConcurrentBatchProcessor;
  let mockOnProcessingComplete: ReturnType<typeof vi.fn>;
  let mockOnProcessingCancelled: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  const defaultProps: ProcessingDashboardProps = {
    batchProcessor: mockBatchProcessor,
    onProcessingComplete: mockOnProcessingComplete,
    onProcessingCancelled: mockOnProcessingCancelled,
    onError: mockOnError
  };

  beforeEach(() => {
    mockBatchProcessor = createMockBatchProcessor();
    mockOnProcessingComplete = vi.fn();
    mockOnProcessingCancelled = vi.fn();
    mockOnError = vi.fn();
    
    defaultProps.batchProcessor = mockBatchProcessor;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should render without crashing', () => {
      render(<ProcessingDashboard {...defaultProps} />);
      // Should not show processing UI when not processing
      expect(screen.queryByText('Processing Documents')).not.toBeInTheDocument();
    });

    it('should not show processing UI when not processing', () => {
      render(<ProcessingDashboard {...defaultProps} />);
      expect(screen.queryByText('Processing Documents')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Processing State', () => {
    it('should show processing UI when batch processor is processing', () => {
      // Mock that processing is active
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50,
        estimatedTimeRemaining: 5000
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('Processing Documents')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should display progress information correctly', () => {
      // Mock that processing is active with specific progress
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'document.docx',
        filesProcessed: 3,
        totalFiles: 5,
        percentage: 60,
        estimatedTimeRemaining: 10000
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('3 of 5 files')).toBeInTheDocument();
      expect(screen.getByText('document.docx')).toBeInTheDocument();
      expect(screen.getByText('10s remaining')).toBeInTheDocument();
    });

    it('should update progress bar width based on percentage', () => {
      // Mock processing with 75% progress
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 3,
        totalFiles: 4,
        percentage: 75
      });

      render(<ProcessingDashboard {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 75%');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  describe('Cancel Functionality', () => {
    it('should call cancelProcessing when cancel button is clicked', () => {
      // Mock that processing is active
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50
      });

      // Update props with the mock functions
      const propsWithMocks = {
        ...defaultProps,
        onProcessingCancelled: mockOnProcessingCancelled
      };

      render(<ProcessingDashboard {...propsWithMocks} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockBatchProcessor.cancelProcessing).toHaveBeenCalled();
      expect(mockOnProcessingCancelled).toHaveBeenCalled();
    });

    it('should have proper accessibility attributes for cancel button', () => {
      // Mock that processing is active
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);

      render(<ProcessingDashboard {...defaultProps} />);

      const cancelButton = screen.getByLabelText('Cancel processing');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format time remaining correctly for seconds', () => {
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50,
        estimatedTimeRemaining: 30000 // 30 seconds
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('30s remaining')).toBeInTheDocument();
    });

    it('should format time remaining correctly for minutes', () => {
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50,
        estimatedTimeRemaining: 125000 // 2 minutes 5 seconds
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('2m 5s remaining')).toBeInTheDocument();
    });

    it('should show calculating when no time estimate available', () => {
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 0,
        totalFiles: 2,
        percentage: 0
        // No estimatedTimeRemaining
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });
  });

  describe('File Name Formatting', () => {
    it('should format long filenames correctly', () => {
      const longFilename = 'this-is-a-very-long-filename-that-should-be-truncated-for-display.docx';
      
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: longFilename,
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50
      });

      render(<ProcessingDashboard {...defaultProps} />);

      // Should show truncated version (check the actual output from the test)
      expect(screen.getByText('this-is-a-very-...display.docx')).toBeInTheDocument();
    });

    it('should show full filename when short', () => {
      const shortFilename = 'short.docx';
      
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: shortFilename,
        filesProcessed: 1,
        totalFiles: 2,
        percentage: 50
      });

      render(<ProcessingDashboard {...defaultProps} />);

      expect(screen.getByText('short.docx')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for progress bar', () => {
      vi.mocked(mockBatchProcessor.isProcessing).mockReturnValue(true);
      vi.mocked(mockBatchProcessor.getProgress).mockReturnValue({
        currentFile: 'test.docx',
        filesProcessed: 3,
        totalFiles: 5,
        percentage: 60
      });

      render(<ProcessingDashboard {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '60');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', 'Processing progress: 60%');
    });
  });
});