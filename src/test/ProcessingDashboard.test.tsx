import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ProcessingDashboard, { ProcessingDashboardProps } from '../components/ProcessingDashboard';
import { ConcurrentBatchProcessor } from '../services/batchProcessor';
import { ProcessingProgress, BatchResult, ProcessingOptions } from '../models';

// Mock the batch processor
class MockBatchProcessor extends ConcurrentBatchProcessor {
  private mockProgress: ProcessingProgress = {
    currentFile: '',
    filesProcessed: 0,
    totalFiles: 0,
    percentage: 0
  };
  private mockIsProcessing = false;
  private mockProcessingPromise: Promise<BatchResult> | null = null;
  private mockResolveProcessing: ((result: BatchResult) => void) | null = null;
  private mockRejectProcessing: ((error: Error) => void) | null = null;

  constructor() {
    super(3, 500);
  }

  // Override methods for testing
  isProcessing(): boolean {
    return this.mockIsProcessing;
  }

  getProgress(): ProcessingProgress {
    return { ...this.mockProgress };
  }

  async processFilePaths(filePaths: string[], options: ProcessingOptions): Promise<BatchResult> {
    this.mockIsProcessing = true;
    this.mockProgress = {
      currentFile: filePaths[0] || '',
      filesProcessed: 0,
      totalFiles: filePaths.length,
      percentage: 0
    };

    // Create a promise that can be resolved/rejected externally
    this.mockProcessingPromise = new Promise<BatchResult>((resolve, reject) => {
      this.mockResolveProcessing = resolve;
      this.mockRejectProcessing = reject;
    });

    return this.mockProcessingPromise;
  }

  cancelProcessing(): void {
    this.mockIsProcessing = false;
    if (this.mockRejectProcessing) {
      this.mockRejectProcessing(new Error('Processing cancelled by user'));
    }
  }

  // Test helper methods
  mockUpdateProgress(progress: Partial<ProcessingProgress>): void {
    this.mockProgress = { ...this.mockProgress, ...progress };
  }

  mockCompleteProcessing(result: BatchResult): void {
    this.mockIsProcessing = false;
    if (this.mockResolveProcessing) {
      this.mockResolveProcessing(result);
    }
  }

  mockFailProcessing(error: Error): void {
    this.mockIsProcessing = false;
    if (this.mockRejectProcessing) {
      this.mockRejectProcessing(error);
    }
  }
}

describe('ProcessingDashboard', () => {
  let mockBatchProcessor: MockBatchProcessor;
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
    mockBatchProcessor = new MockBatchProcessor();
    mockOnProcessingComplete = vi.fn();
    mockOnProcessingCancelled = vi.fn();
    mockOnError = vi.fn();
    
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should render without crashing', () => {
      render(<ProcessingDashboard {...defaultProps} />);
      expect(screen.queryByText('Processing Documents')).not.toBeInTheDocument();
    });

    it('should not show processing UI when not processing', () => {
      render(<ProcessingDashboard {...defaultProps} />);
      expect(screen.queryByText('Processing Documents')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Processing State', () => {
    it('should show processing UI when processing starts', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx', 'test2.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Processing Documents')).toBeInTheDocument();
      });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should display progress information correctly', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx', 'test2.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          currentFile: 'test1.docx',
          filesProcessed: 1,
          totalFiles: 2,
          percentage: 50,
          estimatedTimeRemaining: 5000
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByText('1 of 2 files')).toBeInTheDocument();
        expect(screen.getByText('test1.docx')).toBeInTheDocument();
        expect(screen.getByText('5s remaining')).toBeInTheDocument();
      });
    });

    it('should update progress bar width based on percentage', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress to 75%
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          percentage: 75
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveStyle('width: 75%');
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      });
    });

    it('should format long filenames correctly', async () => {
      const longFilename = 'this-is-a-very-long-filename-that-should-be-truncated-for-display.docx';
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths([longFilename], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress with long filename
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          currentFile: longFilename
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        // Should show truncated version
        expect(screen.getByText('this-is-a-very-...play.docx')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should call cancelProcessing when cancel button is clicked', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      const cancelButton = await screen.findByText('Cancel');
      
      // Spy on the cancel method
      const cancelSpy = vi.spyOn(mockBatchProcessor, 'cancelProcessing');
      
      fireEvent.click(cancelButton);

      expect(cancelSpy).toHaveBeenCalled();
      expect(mockOnProcessingCancelled).toHaveBeenCalled();
    });

    it('should have proper accessibility attributes for cancel button', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      const cancelButton = await screen.findByLabelText('Cancel processing');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Completion State', () => {
    it('should show completion summary when processing finishes successfully', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx', 'test2.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Complete processing
      const mockResult: BatchResult = {
        totalFiles: 2,
        successfulFiles: 2,
        failedFiles: 0,
        results: [
          {
            filename: 'test1.docx',
            success: true,
            processingTime: 1000,
            output: {
              title: 'Test Document 1',
              sections: [],
              metadata: {
                processedAt: new Date(),
                processingTime: 1000,
                originalFormat: 'docx',
                warnings: [],
                errors: []
              }
            }
          },
          {
            filename: 'test2.docx',
            success: true,
            processingTime: 1500,
            output: {
              title: 'Test Document 2',
              sections: [],
              metadata: {
                processedAt: new Date(),
                processingTime: 1500,
                originalFormat: 'docx',
                warnings: [],
                errors: []
              }
            }
          }
        ],
        totalProcessingTime: 2500
      };

      act(() => {
        mockBatchProcessor.mockCompleteProcessing(mockResult);
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Processing Complete')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total files
        expect(screen.getByText('2')).toBeInTheDocument(); // Successful files
        expect(screen.getByText('0')).toBeInTheDocument(); // Failed files
      });

      expect(mockOnProcessingComplete).toHaveBeenCalledWith(mockResult);
    });

    it('should show completion summary with failures', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx', 'test2.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Complete processing with failures
      const mockResult: BatchResult = {
        totalFiles: 2,
        successfulFiles: 1,
        failedFiles: 1,
        results: [
          {
            filename: 'test1.docx',
            success: true,
            processingTime: 1000,
            output: {
              title: 'Test Document 1',
              sections: [],
              metadata: {
                processedAt: new Date(),
                processingTime: 1000,
                originalFormat: 'docx',
                warnings: [],
                errors: []
              }
            }
          },
          {
            filename: 'test2.docx',
            success: false,
            error: 'File corrupted',
            processingTime: 500
          }
        ],
        totalProcessingTime: 1500
      };

      act(() => {
        mockBatchProcessor.mockCompleteProcessing(mockResult);
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Processing Complete')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // Successful files
        expect(screen.getByText('1')).toBeInTheDocument(); // Failed files
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when processing fails', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Fail processing
      const error = new Error('Processing failed due to memory error');
      act(() => {
        mockBatchProcessor.mockFailProcessing(error);
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Processing Error')).toBeInTheDocument();
        expect(screen.getByText('Processing failed due to memory error')).toBeInTheDocument();
      });

      expect(mockOnError).toHaveBeenCalledWith('Processing failed due to memory error');
    });
  });

  describe('Time Formatting', () => {
    it('should format time remaining correctly for seconds', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress with time remaining
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          estimatedTimeRemaining: 30000 // 30 seconds
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('30s remaining')).toBeInTheDocument();
      });
    });

    it('should format time remaining correctly for minutes', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress with time remaining
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          estimatedTimeRemaining: 125000 // 2 minutes 5 seconds
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('2m 5s remaining')).toBeInTheDocument();
      });
    });

    it('should show calculating when no time estimate available', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Calculating...')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Updates', () => {
    it('should poll for progress updates during processing', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      const getProgressSpy = vi.spyOn(mockBatchProcessor, 'getProgress');
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      // Advance timers to trigger progress updates
      act(() => {
        vi.advanceTimersByTime(500); // 5 updates at 100ms intervals
      });

      expect(getProgressSpy).toHaveBeenCalledTimes(5);
    });

    it('should stop polling when processing completes', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      const getProgressSpy = vi.spyOn(mockBatchProcessor, 'getProgress');
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Complete processing
      act(() => {
        mockBatchProcessor.mockCompleteProcessing({
          totalFiles: 1,
          successfulFiles: 1,
          failedFiles: 0,
          results: [],
          totalProcessingTime: 1000
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      // Clear previous calls
      getProgressSpy.mockClear();

      // Advance timers - should not poll anymore
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(getProgressSpy).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for progress bar', async () => {
      const { rerender } = render(<ProcessingDashboard {...defaultProps} />);
      
      // Start processing
      act(() => {
        mockBatchProcessor.processFilePaths(['test1.docx'], {
          outputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          customSettings: {}
        });
      });

      // Update progress
      act(() => {
        mockBatchProcessor.mockUpdateProgress({
          percentage: 60
        });
      });

      rerender(<ProcessingDashboard {...defaultProps} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '60');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        expect(progressBar).toHaveAttribute('aria-label', 'Processing progress: 60%');
      });
    });
  });
});