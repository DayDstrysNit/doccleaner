import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ConcurrentBatchProcessor } from '../services/batchProcessor';
import { MammothDocumentParser } from '../services/documentParser';
import { WordContentProcessor } from '../services/contentProcessor';
import {
  ProcessingOptions,
  DocumentModel,
  StructuredContent,
  ProcessingMetadata
} from '../models';
import {
  ProcessingError,
  FileAccessError,
  ParsingError,
  MemoryError
} from '../models/errors';
import * as fs from 'fs/promises';

// Mock the dependencies
vi.mock('../services/documentParser');
vi.mock('../services/contentProcessor');
vi.mock('fs/promises');

describe('ConcurrentBatchProcessor', () => {
  let batchProcessor: ConcurrentBatchProcessor;
  let mockDocumentParser: Mock;
  let mockContentProcessor: Mock;
  let mockFs: typeof fs;

  const mockProcessingOptions: ProcessingOptions = {
    outputFormat: 'html',
    preserveImages: false,
    includeMetadata: true,
    cleanupLevel: 'standard',
    customSettings: {}
  };

  const mockDocumentModel: DocumentModel = {
    metadata: {
      filename: 'test.docx',
      fileSize: 1024,
      createdDate: new Date(),
      modifiedDate: new Date()
    },
    content: [
      {
        type: 'heading',
        level: 1,
        content: 'Test Heading'
      },
      {
        type: 'paragraph',
        content: 'Test paragraph content'
      }
    ],
    styles: [],
    images: []
  };

  const mockStructuredContent: StructuredContent = {
    title: 'Test Document',
    sections: [
      {
        type: 'heading',
        level: 1,
        content: 'Test Heading'
      },
      {
        type: 'paragraph',
        content: 'Test paragraph content'
      }
    ],
    metadata: {
      processedAt: new Date(),
      processingTime: 100,
      originalFormat: 'docx',
      warnings: [],
      errors: []
    } as ProcessingMetadata
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup fs mocks
    mockFs = fs as any;
    mockFs.access = vi.fn().mockResolvedValue(undefined);
    
    // Setup document parser mocks
    mockDocumentParser = vi.mocked(MammothDocumentParser);
    mockDocumentParser.prototype.validateDocument = vi.fn().mockResolvedValue(true);
    mockDocumentParser.prototype.parseDocument = vi.fn().mockResolvedValue(mockDocumentModel);
    
    // Setup content processor mocks
    mockContentProcessor = vi.mocked(WordContentProcessor);
    mockContentProcessor.prototype.cleanContent = vi.fn().mockResolvedValue(mockStructuredContent);
    
    // Create new batch processor instance
    batchProcessor = new ConcurrentBatchProcessor(2, 100); // 2 concurrent files, 100MB threshold
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processFilePaths', () => {
    it('should successfully process multiple files', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx'];
      
      const result = await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      expect(result.totalFiles).toBe(3);
      expect(result.successfulFiles).toBe(3);
      expect(result.failedFiles).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      
      // Verify all files were processed successfully
      result.results.forEach((fileResult, index) => {
        expect(fileResult.filename).toBe(`file${index + 1}.docx`);
        expect(fileResult.success).toBe(true);
        expect(fileResult.output).toEqual(mockStructuredContent);
        expect(fileResult.processingTime).toBeGreaterThan(0);
      });
    });

    it('should handle individual file failures without stopping batch processing', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx'];
      
      // Make the second file fail
      mockDocumentParser.prototype.parseDocument
        .mockResolvedValueOnce(mockDocumentModel) // file1 succeeds
        .mockRejectedValueOnce(new ParsingError('Parse failed', 'file2.docx')) // file2 fails
        .mockResolvedValueOnce(mockDocumentModel); // file3 succeeds
      
      const result = await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      expect(result.totalFiles).toBe(3);
      expect(result.successfulFiles).toBe(2);
      expect(result.failedFiles).toBe(1);
      expect(result.results).toHaveLength(3);
      
      // Check specific results
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Document parsing error');
      expect(result.results[2].success).toBe(true);
    });

    it('should handle file access errors gracefully', async () => {
      const filePaths = ['nonexistent.docx'];
      
      mockFs.access = vi.fn().mockRejectedValue(new Error('File not found'));
      mockDocumentParser.prototype.validateDocument = vi.fn().mockResolvedValue(false);
      
      const result = await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      expect(result.totalFiles).toBe(1);
      expect(result.successfulFiles).toBe(0);
      expect(result.failedFiles).toBe(0); // File was filtered out during validation
      expect(result.results).toHaveLength(0);
    });

    it('should respect concurrency limits', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx', 'file4.docx', 'file5.docx'];
      
      // Track when parsing starts for each file
      const parseStartTimes: number[] = [];
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        parseStartTimes.push(Date.now());
        // Add small delay to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockDocumentModel;
      });
      
      await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // With concurrency limit of 2, we should see batched processing
      expect(mockDocumentParser.prototype.parseDocument).toHaveBeenCalledTimes(5);
    });

    it('should throw error if already processing', async () => {
      const filePaths = ['file1.docx'];
      
      // Start first processing (don't await)
      const firstProcessing = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // Try to start second processing
      await expect(
        batchProcessor.processFilePaths(filePaths, mockProcessingOptions)
      ).rejects.toThrow(ProcessingError);
      
      // Wait for first processing to complete
      await firstProcessing;
    });

    it('should handle content processing errors', async () => {
      const filePaths = ['file1.docx'];
      
      mockContentProcessor.prototype.cleanContent = vi.fn()
        .mockRejectedValue(new ProcessingError('Content processing failed', 'content_cleaning'));
      
      const result = await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      expect(result.successfulFiles).toBe(0);
      expect(result.failedFiles).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Content processing error');
    });
  });

  describe('progress tracking', () => {
    it('should track progress correctly', async () => {
      const filePaths = ['file1.docx', 'file2.docx'];
      
      // Add delay to parsing to allow progress checking
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockDocumentModel;
      });
      
      // Start processing
      const processingPromise = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // Check initial progress
      let progress = batchProcessor.getProgress();
      expect(progress.totalFiles).toBe(2);
      expect(progress.filesProcessed).toBe(0);
      expect(progress.percentage).toBe(0);
      
      // Wait for processing to complete
      await processingPromise;
      
      // Check final progress
      progress = batchProcessor.getProgress();
      expect(progress.filesProcessed).toBe(2);
      expect(progress.percentage).toBe(100);
    });

    it('should calculate estimated time remaining', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx'];
      
      let callCount = 0;
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First file takes longer to allow progress check
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return mockDocumentModel;
      });
      
      const processingPromise = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // Wait a bit for first file to complete
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const progress = batchProcessor.getProgress();
      expect(progress.estimatedTimeRemaining).toBeDefined();
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
      
      await processingPromise;
    });
  });

  describe('cancellation', () => {
    it('should cancel processing when requested', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx'];
      
      // Add delay to allow cancellation
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return mockDocumentModel;
      });
      
      // Start processing
      const processingPromise = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // Cancel after short delay
      setTimeout(() => {
        batchProcessor.cancelProcessing();
      }, 100);
      
      const result = await processingPromise;
      
      // Should have some cancelled results
      const cancelledResults = result.results.filter(r => 
        !r.success && r.error?.includes('cancelled')
      );
      expect(cancelledResults.length).toBeGreaterThan(0);
    });

    it('should reset processing state after cancellation', async () => {
      const filePaths = ['file1.docx'];
      
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return mockDocumentModel;
      });
      
      // Start and cancel processing
      const processingPromise = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      batchProcessor.cancelProcessing();
      await processingPromise;
      
      // Should be able to start new processing
      expect(batchProcessor.isProcessing()).toBe(false);
      
      const newResult = await batchProcessor.processFilePaths(['file2.docx'], mockProcessingOptions);
      expect(newResult.totalFiles).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle different error types with appropriate messages', async () => {
      const filePaths = ['file1.docx', 'file2.docx', 'file3.docx', 'file4.docx'];
      
      mockDocumentParser.prototype.parseDocument
        .mockRejectedValueOnce(new FileAccessError('Access denied', 'file1.docx'))
        .mockRejectedValueOnce(new ParsingError('Invalid format', 'file2.docx'))
        .mockRejectedValueOnce(new ProcessingError('Processing failed', 'content_processing'))
        .mockRejectedValueOnce(new Error('Unknown error'));
      
      const result = await batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      expect(result.failedFiles).toBe(4);
      expect(result.results[0].error).toContain('File access error');
      expect(result.results[1].error).toContain('Document parsing error');
      expect(result.results[2].error).toContain('Content processing error');
      expect(result.results[3].error).toContain('Unexpected error');
    });

    it('should handle memory threshold errors', async () => {
      // Create processor with very low memory threshold
      const lowMemoryProcessor = new ConcurrentBatchProcessor(1, 1); // 1MB threshold
      
      // Mock process.memoryUsage to return high memory usage
      const originalProcess = global.process;
      global.process = {
        ...originalProcess,
        memoryUsage: vi.fn().mockReturnValue({
          heapUsed: 2 * 1024 * 1024 // 2MB
        })
      } as any;
      
      const filePaths = ['file1.docx'];
      
      await expect(
        lowMemoryProcessor.processFilePaths(filePaths, mockProcessingOptions)
      ).rejects.toThrow(MemoryError);
      
      // Restore original process
      global.process = originalProcess;
    });
  });

  describe('configuration', () => {
    it('should allow updating configuration when not processing', () => {
      expect(() => {
        batchProcessor.updateConfiguration({
          maxConcurrentFiles: 5,
          memoryThreshold: 200
        });
      }).not.toThrow();
      
      const stats = batchProcessor.getProcessingStats();
      expect(stats.maxConcurrentFiles).toBe(5);
      expect(stats.memoryThreshold).toBe(200);
    });

    it('should prevent configuration updates during processing', async () => {
      const filePaths = ['file1.docx'];
      
      mockDocumentParser.prototype.parseDocument = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockDocumentModel;
      });
      
      // Start processing
      const processingPromise = batchProcessor.processFilePaths(filePaths, mockProcessingOptions);
      
      // Try to update configuration
      expect(() => {
        batchProcessor.updateConfiguration({ maxConcurrentFiles: 5 });
      }).toThrow(ProcessingError);
      
      await processingPromise;
    });

    it('should enforce configuration limits', () => {
      batchProcessor.updateConfiguration({
        maxConcurrentFiles: 15, // Should be capped at 10
        memoryThreshold: 50 // Should be raised to 100
      });
      
      const stats = batchProcessor.getProcessingStats();
      expect(stats.maxConcurrentFiles).toBe(10);
      expect(stats.memoryThreshold).toBe(100);
    });
  });

  describe('processing statistics', () => {
    it('should provide accurate processing statistics', () => {
      const stats = batchProcessor.getProcessingStats();
      
      expect(stats).toHaveProperty('maxConcurrentFiles');
      expect(stats).toHaveProperty('memoryThreshold');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('currentProgress');
      
      expect(stats.isProcessing).toBe(false);
      expect(stats.currentProgress.totalFiles).toBe(0);
    });
  });
});