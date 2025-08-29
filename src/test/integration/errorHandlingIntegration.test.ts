import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConcurrentBatchProcessor } from '../../services/batchProcessor';
import { MammothDocumentParser } from '../../services/documentParser';
import { WordContentProcessor } from '../../services/contentProcessor';
import { globalErrorHandler } from '../../services/errorHandler';
import { logger, LogLevel } from '../../services/logger';
import { errorRecoveryService } from '../../services/errorRecovery';
import {
  FileAccessError,
  ParsingError,
  ProcessingError,
  MemoryError,
  UnsupportedFormatError,
  RecoveryAction
} from '../../models/errors';
import { ProcessingOptions } from '../../models';

describe('Error Handling Integration', () => {
  let batchProcessor: ConcurrentBatchProcessor;
  let mockParser: MammothDocumentParser;
  let mockContentProcessor: WordContentProcessor;

  beforeEach(() => {
    // Clear error stats and logs
    globalErrorHandler.clearErrorStats();
    logger.clearLogs();

    // Create batch processor with mocked dependencies
    batchProcessor = new ConcurrentBatchProcessor(2, 100); // 2 concurrent, 100MB memory limit

    // Mock the internal services
    mockParser = {
      parseDocument: vi.fn(),
      validateDocument: vi.fn(),
      getSupportedFormats: vi.fn().mockReturnValue(['.docx']),
      isFormatSupported: vi.fn().mockReturnValue(true)
    } as any;

    mockContentProcessor = {
      cleanContent: vi.fn(),
      preserveStructure: vi.fn(),
      stripFormatting: vi.fn(),
      extractTextContent: vi.fn()
    } as any;

    // Replace internal services
    (batchProcessor as any).documentParser = mockParser;
    (batchProcessor as any).contentProcessor = mockContentProcessor;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('File Access Error Handling', () => {
    it('should handle file not found errors gracefully', async () => {
      const filePaths = ['/nonexistent/file1.docx', '/nonexistent/file2.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Mock file access errors
      mockParser.parseDocument.mockRejectedValue(
        new FileAccessError('File not found', '/nonexistent/file1.docx')
      );

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.totalFiles).toBe(2);
      expect(result.failedFiles).toBe(2);
      expect(result.successfulFiles).toBe(0);

      // Check error statistics
      const errorStats = globalErrorHandler.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      expect(errorStats.errorsByCategory['FILE_ACCESS']).toBeGreaterThan(0);

      // Check that user-friendly messages are provided
      result.results.forEach(fileResult => {
        expect(fileResult.success).toBe(false);
        expect(fileResult.error).toContain('file could not be found');
      });
    });

    it('should continue processing other files when one fails', async () => {
      const filePaths = ['/test/file1.docx', '/test/file2.docx', '/test/file3.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Mock mixed success/failure
      mockParser.parseDocument
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] })
        .mockRejectedValueOnce(new FileAccessError('File not found', '/test/file2.docx'))
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] });

      mockContentProcessor.cleanContent.mockResolvedValue({
        title: 'Test',
        sections: [],
        metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] }
      });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.totalFiles).toBe(3);
      expect(result.successfulFiles).toBe(2);
      expect(result.failedFiles).toBe(1);

      // Verify that processing continued despite the error
      expect(mockParser.parseDocument).toHaveBeenCalledTimes(3);
    });
  });

  describe('Parsing Error Recovery', () => {
    it('should attempt recovery for parsing errors', async () => {
      const filePaths = ['/test/complex.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: true,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Mock parsing error followed by success with fallback
      const parsingError = new ParsingError('Complex structure failed', '/test/complex.docx');
      parsingError.code = 'DOCUMENT_PARSING_ERROR' as any;

      mockParser.parseDocument
        .mockRejectedValueOnce(parsingError)
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] });

      mockContentProcessor.cleanContent.mockResolvedValue({
        title: 'Test',
        sections: [],
        metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] }
      });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(0);

      // Verify recovery was attempted
      expect(mockParser.parseDocument).toHaveBeenCalledTimes(2);

      // Check logs for recovery attempts
      const logEntries = logger.getLogEntries();
      const recoveryLogs = logEntries.filter(entry => 
        entry.category === 'error_handling' && 
        entry.message.includes('Recovery attempted')
      );
      expect(recoveryLogs.length).toBeGreaterThan(0);
    });

    it('should skip unsupported format errors without retry', async () => {
      const filePaths = ['/test/document.pdf'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      const unsupportedError = new UnsupportedFormatError('/test/document.pdf', 'pdf');
      mockParser.parseDocument.mockRejectedValue(unsupportedError);

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.failedFiles).toBe(1);
      expect(result.successfulFiles).toBe(0);

      // Should only be called once (no retry)
      expect(mockParser.parseDocument).toHaveBeenCalledTimes(1);

      // Check that appropriate error message is provided
      expect(result.results[0].error).toContain('file format is not supported');
    });
  });

  describe('Memory Error Handling', () => {
    it('should handle memory errors with optimization strategy', async () => {
      const filePaths = ['/test/large.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: true,
        cleanupLevel: 'minimal',
        customSettings: { batchSize: 10 }
      };

      // Mock memory error followed by success with optimized options
      const memoryError = new MemoryError('Out of memory during processing');
      
      mockParser.parseDocument.mockResolvedValue({ metadata: {}, content: [], styles: [], images: [] });
      mockContentProcessor.cleanContent
        .mockRejectedValueOnce(memoryError)
        .mockResolvedValueOnce({
          title: 'Test',
          sections: [],
          metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] }
        });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(0);

      // Verify recovery was attempted
      expect(mockContentProcessor.cleanContent).toHaveBeenCalledTimes(2);

      // Check that memory optimization was logged
      const logEntries = logger.getLogEntries();
      const memoryLogs = logEntries.filter(entry => 
        entry.message.includes('memory optimization')
      );
      expect(memoryLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Format Conversion Error Recovery', () => {
    it('should fallback to alternative formats on conversion errors', async () => {
      const filePaths = ['/test/document.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Mock successful parsing but failed format conversion
      mockParser.parseDocument.mockResolvedValue({ metadata: {}, content: [], styles: [], images: [] });
      
      const conversionError = new ProcessingError('HTML conversion failed', 'format_conversion');
      conversionError.code = 'FORMAT_CONVERSION_ERROR' as any;
      
      mockContentProcessor.cleanContent
        .mockRejectedValueOnce(conversionError)
        .mockResolvedValueOnce({
          title: 'Test',
          sections: [],
          metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] }
        });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(0);

      // Verify fallback was attempted
      expect(mockContentProcessor.cleanContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Comprehensive Error Statistics', () => {
    it('should track comprehensive error statistics across batch processing', async () => {
      const filePaths = [
        '/test/file1.docx',    // Success
        '/test/missing.docx',  // File not found
        '/test/corrupt.docx',  // Parsing error
        '/test/large.docx',    // Memory error (recoverable)
        '/test/file5.docx'     // Success
      ];

      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Mock various error scenarios
      mockParser.parseDocument
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] }) // Success
        .mockRejectedValueOnce(new FileAccessError('File not found', '/test/missing.docx')) // File error
        .mockRejectedValueOnce(new ParsingError('Corrupted file', '/test/corrupt.docx')) // Parse error
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] }) // Success after retry
        .mockResolvedValueOnce({ metadata: {}, content: [], styles: [], images: [] }); // Success

      mockContentProcessor.cleanContent
        .mockResolvedValueOnce({ title: 'Test1', sections: [], metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] } })
        .mockRejectedValueOnce(new MemoryError('Out of memory')) // Memory error
        .mockResolvedValueOnce({ title: 'Test4', sections: [], metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] } }) // Recovery success
        .mockResolvedValueOnce({ title: 'Test5', sections: [], metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] } });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      // Check final results
      expect(result.totalFiles).toBe(5);
      expect(result.successfulFiles).toBe(3); // 1, 4 (after recovery), 5
      expect(result.failedFiles).toBe(2); // 2 (file not found), 3 (parsing error)

      // Check comprehensive error statistics
      const errorStats = globalErrorHandler.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      expect(errorStats.errorsByCategory['FILE_ACCESS']).toBeGreaterThan(0);
      expect(errorStats.errorsByCategory['PARSING']).toBeGreaterThan(0);
      expect(errorStats.errorsByCategory['SYSTEM']).toBeGreaterThan(0); // Memory error

      // Check that recent errors are tracked
      expect(errorStats.recentErrors.length).toBeGreaterThan(0);

      // Verify logging captured all operations
      const logEntries = logger.getLogEntries();
      const errorLogs = logEntries.filter(entry => entry.level >= LogLevel.WARN);
      expect(errorLogs.length).toBeGreaterThan(0);

      // Check performance logging
      const performanceLogs = logEntries.filter(entry => entry.category === 'performance');
      expect(performanceLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery Service Integration', () => {
    it('should use recovery service for automatic error handling', async () => {
      const filePaths = ['/test/problematic.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: true,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Create a custom recovery strategy for testing
      const customStrategy = {
        canHandle: (error: any) => error.code === 'CUSTOM_ERROR',
        execute: async () => ({
          success: true,
          action: RecoveryAction.FALLBACK,
          message: 'Custom recovery applied',
          shouldRetry: true,
          modifiedOptions: {
            ...options,
            cleanupLevel: 'aggressive' as const
          }
        })
      };

      errorRecoveryService.registerStrategy(customStrategy);

      // Mock custom error followed by success
      const customError = new ProcessingError('Custom processing error', 'custom_stage');
      customError.code = 'CUSTOM_ERROR' as any;

      mockParser.parseDocument.mockResolvedValue({ metadata: {}, content: [], styles: [], images: [] });
      mockContentProcessor.cleanContent
        .mockRejectedValueOnce(customError)
        .mockResolvedValueOnce({
          title: 'Test',
          sections: [],
          metadata: { processedAt: new Date(), processingTime: 100, originalFormat: 'docx', warnings: [], errors: [] }
        });

      const result = await batchProcessor.processFilePaths(filePaths, options);

      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(0);

      // Verify custom recovery was used
      const logEntries = logger.getLogEntries();
      const recoveryLogs = logEntries.filter(entry => 
        entry.message.includes('Custom recovery applied')
      );
      expect(recoveryLogs.length).toBeGreaterThan(0);
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide user-friendly error messages in results', async () => {
      const filePaths = ['/test/various-errors.docx'];
      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      // Test various error types
      const errors = [
        new FileAccessError('Permission denied', '/test/file.docx'),
        new UnsupportedFormatError('/test/file.pdf', 'pdf'),
        new MemoryError('Out of memory'),
        new ParsingError('Corrupted document', '/test/file.docx')
      ];

      errors[0].code = 'FILE_PERMISSION_ERROR' as any;
      errors[1].code = 'UNSUPPORTED_FORMAT' as any;
      errors[2].code = 'MEMORY_ERROR' as any;
      errors[3].code = 'CORRUPTED_FILE' as any;

      for (const error of errors) {
        mockParser.parseDocument.mockRejectedValueOnce(error);
        
        const result = await batchProcessor.processFilePaths(['/test/test.docx'], options);
        
        expect(result.results[0].success).toBe(false);
        expect(result.results[0].error).not.toContain('Error:'); // Should not contain technical error prefixes
        expect(result.results[0].error).toMatch(/^[A-Z]/); // Should start with capital letter
        expect(result.results[0].error).toMatch(/\.$/); // Should end with period
      }
    });
  });
});