import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DocumentProcessorProvider } from '../../context/DocumentProcessorContext';
import { useDocumentProcessor } from '../../hooks/useDocumentProcessor';
import { ProcessingOptions } from '../../models';
import { FileInfo } from '../../components/FileSelector';

// Mock services
vi.mock('../../services/batchProcessor');
vi.mock('../../services/documentParser');
vi.mock('../../services/contentProcessor');
vi.mock('../../services/formatConverter');

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const [state, actions] = useDocumentProcessor();

  const handleStartProcessing = async () => {
    const mockFiles: FileInfo[] = [
      {
        file: new File(['test content'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        name: 'test.docx',
        size: 1024,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        lastModified: new Date(),
        isValid: true
      }
    ];

    const options: ProcessingOptions = {
      outputFormat: 'plaintext',
      preserveImages: false,
      includeMetadata: false,
      cleanupLevel: 'standard',
      customSettings: {}
    };

    await actions.startProcessing(mockFiles, options);
  };

  return (
    <div>
      <div data-testid="processing-state">
        {state.isProcessing ? 'Processing' : 'Idle'}
      </div>
      <div data-testid="results-count">
        {state.results.length}
      </div>
      <div data-testid="error-message">
        {state.error || 'No error'}
      </div>
      <button onClick={handleStartProcessing} data-testid="start-processing">
        Start Processing
      </button>
      <button onClick={actions.cancelProcessing} data-testid="cancel-processing">
        Cancel Processing
      </button>
      <button onClick={actions.clearResults} data-testid="clear-results">
        Clear Results
      </button>
    </div>
  );
};

describe('Document Processor Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    render(
      <DocumentProcessorProvider>
        <TestComponent />
      </DocumentProcessorProvider>
    );

    expect(screen.getByTestId('processing-state')).toHaveTextContent('Idle');
    expect(screen.getByTestId('results-count')).toHaveTextContent('0');
    expect(screen.getByTestId('error-message')).toHaveTextContent('No error');
  });

  it('should handle processing workflow', async () => {
    // Mock successful processing
    const { ConcurrentBatchProcessor } = await import('../../services/batchProcessor');
    const mockProcessFilePaths = vi.fn().mockResolvedValue({
      totalFiles: 1,
      successfulFiles: 1,
      failedFiles: 0,
      results: [
        {
          filename: 'test.docx',
          success: true,
          output: {
            title: 'Test Document',
            sections: [
              {
                type: 'paragraph',
                content: 'Test content',
                children: []
              }
            ],
            metadata: {
              processedAt: new Date(),
              processingTime: 100,
              originalFormat: 'docx',
              warnings: [],
              errors: []
            }
          },
          processingTime: 100
        }
      ],
      totalProcessingTime: 100
    });

    const mockIsProcessing = vi.fn().mockReturnValue(false);
    const mockGetProgress = vi.fn().mockReturnValue({
      currentFile: '',
      filesProcessed: 1,
      totalFiles: 1,
      percentage: 100
    });

    vi.mocked(ConcurrentBatchProcessor).mockImplementation(() => ({
      processFilePaths: mockProcessFilePaths,
      isProcessing: mockIsProcessing,
      getProgress: mockGetProgress,
      cancelProcessing: vi.fn(),
      processFiles: vi.fn()
    } as any));

    render(
      <DocumentProcessorProvider>
        <TestComponent />
      </DocumentProcessorProvider>
    );

    // Start processing
    fireEvent.click(screen.getByTestId('start-processing'));

    // Wait for processing to complete
    await waitFor(() => {
      expect(screen.getByTestId('results-count')).toHaveTextContent('1');
    });

    expect(screen.getByTestId('processing-state')).toHaveTextContent('Idle');
  });

  it('should handle processing errors', async () => {
    // Mock failed processing
    const { ConcurrentBatchProcessor } = await import('../../services/batchProcessor');
    const mockProcessFilePaths = vi.fn().mockRejectedValue(
      new Error('Processing failed')
    );

    vi.mocked(ConcurrentBatchProcessor).mockImplementation(() => ({
      processFilePaths: mockProcessFilePaths,
      isProcessing: vi.fn().mockReturnValue(false),
      getProgress: vi.fn(),
      cancelProcessing: vi.fn(),
      processFiles: vi.fn()
    } as any));

    render(
      <DocumentProcessorProvider>
        <TestComponent />
      </DocumentProcessorProvider>
    );

    // Start processing
    fireEvent.click(screen.getByTestId('start-processing'));

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Processing failed');
    });

    expect(screen.getByTestId('processing-state')).toHaveTextContent('Idle');
    expect(screen.getByTestId('results-count')).toHaveTextContent('0');
  });

  it('should handle cancel processing', async () => {
    const { ConcurrentBatchProcessor } = await import('../../services/batchProcessor');
    const mockCancelProcessing = vi.fn();
    
    vi.mocked(ConcurrentBatchProcessor).mockImplementation(() => ({
      processFilePaths: vi.fn(),
      isProcessing: vi.fn().mockReturnValue(true),
      getProgress: vi.fn(),
      cancelProcessing: mockCancelProcessing,
      processFiles: vi.fn()
    } as any));

    render(
      <DocumentProcessorProvider>
        <TestComponent />
      </DocumentProcessorProvider>
    );

    // Cancel processing
    fireEvent.click(screen.getByTestId('cancel-processing'));

    expect(mockCancelProcessing).toHaveBeenCalled();
  });

  it('should clear results', async () => {
    render(
      <DocumentProcessorProvider>
        <TestComponent />
      </DocumentProcessorProvider>
    );

    // Clear results
    fireEvent.click(screen.getByTestId('clear-results'));

    expect(screen.getByTestId('results-count')).toHaveTextContent('0');
    expect(screen.getByTestId('error-message')).toHaveTextContent('No error');
  });
});

describe('Document Processor Context', () => {
  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useDocumentProcessorContext must be used within a DocumentProcessorProvider');

    consoleSpy.mockRestore();
  });
});