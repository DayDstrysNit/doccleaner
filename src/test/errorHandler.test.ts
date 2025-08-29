import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CentralizedErrorHandler,
  globalErrorHandler
} from '../services/errorHandler';
import {
  FileAccessError,
  ParsingError,
  ProcessingError,
  SystemError,
  ValidationError,
  ErrorCategory,
  RecoveryAction,
  MemoryError,
  UnsupportedFormatError,
  CorruptedFileError
} from '../models/errors';

describe('CentralizedErrorHandler', () => {
  let errorHandler: CentralizedErrorHandler;

  beforeEach(() => {
    errorHandler = new CentralizedErrorHandler();
    // Clear any existing error stats
    errorHandler.clearErrorStats();
  });

  describe('Error Logging', () => {
    it('should log errors and update statistics', () => {
      const error = new FileAccessError('Test file access error', '/test/file.docx');
      const context = errorHandler.createErrorContext('test_operation', { testData: 'value' });

      errorHandler.logError(error, context);

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.FILE_ACCESS]).toBe(1);
      expect(stats.errorsByCode['FILE_ACCESS_ERROR']).toBe(1);
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0].error).toBe(error);
    });

    it('should maintain recent errors list with maximum size', () => {
      // Create more errors than the maximum
      for (let i = 0; i < 150; i++) {
        const error = new ValidationError(`Test error ${i}`, 'testField', 'testValue');
        const context = errorHandler.createErrorContext('test_operation');
        errorHandler.logError(error, context);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(150);
      expect(stats.recentErrors.length).toBeLessThanOrEqual(100); // Should be capped at maxRecentErrors
    });

    it('should log to console with appropriate levels', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const systemError = new SystemError('System error');
      const fileError = new FileAccessError('File error', '/test/file.docx');
      
      const context = errorHandler.createErrorContext('test_operation');
      
      errorHandler.logError(systemError, context);
      errorHandler.logError(fileError, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SYSTEM] SYSTEM_ERROR: System error'),
        expect.any(Object)
      );
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FILE_ACCESS] FILE_ACCESS_ERROR: File error'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Recovery Actions', () => {
    it('should return SKIP for unsupported format errors', () => {
      const error = new UnsupportedFormatError('/test/file.pdf', 'pdf');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      const action = errorHandler.handleParsingError(error, file);
      expect(action).toBe(RecoveryAction.SKIP);
    });

    it('should return SKIP for corrupted file errors', () => {
      const error = new CorruptedFileError('/test/file.docx');
      const file = new File(['test'], 'test.docx');

      const action = errorHandler.handleParsingError(error, file);
      expect(action).toBe(RecoveryAction.SKIP);
    });

    it('should return FALLBACK for document parsing errors', () => {
      const error = new ParsingError('Parsing failed', '/test/file.docx');
      error.code = 'DOCUMENT_PARSING_ERROR' as any;
      const file = new File(['test'], 'test.docx');

      const action = errorHandler.handleParsingError(error, file);
      expect(action).toBe(RecoveryAction.FALLBACK);
    });

    it('should return RETRY for memory errors in processing', () => {
      const error = new MemoryError('Out of memory');
      const action = errorHandler.handleProcessingError(error);
      expect(action).toBe(RecoveryAction.RETRY);
    });

    it('should return FALLBACK for format conversion errors', () => {
      const error = new ProcessingError('Conversion failed', 'format_conversion');
      error.code = 'FORMAT_CONVERSION_ERROR' as any;
      
      const action = errorHandler.handleProcessingError(error);
      expect(action).toBe(RecoveryAction.FALLBACK);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should return appropriate message for file not found error', () => {
      const error = new FileAccessError('File not found', '/test/file.docx');
      error.code = 'FILE_NOT_FOUND' as any;

      const message = errorHandler.getUserFriendlyMessage(error);
      expect(message).toBe('The selected file could not be found. Please check if the file still exists.');
    });

    it('should return appropriate message for unsupported format error', () => {
      const error = new UnsupportedFormatError('/test/file.pdf', 'pdf');
      
      const message = errorHandler.getUserFriendlyMessage(error);
      expect(message).toBe('This file format is not supported. Please select a DOCX file.');
    });

    it('should return appropriate message for memory error', () => {
      const error = new MemoryError('Out of memory');
      
      const message = errorHandler.getUserFriendlyMessage(error);
      expect(message).toBe('Not enough memory to process this document. Please try with a smaller file or restart the application.');
    });

    it('should return fallback message for unknown error codes', () => {
      const error = new SystemError('Unknown system error');
      error.code = 'UNKNOWN_ERROR' as any;

      const message = errorHandler.getUserFriendlyMessage(error);
      expect(message).toBe('A system error occurred. Please try again or restart the application.');
    });
  });

  describe('Error Recovery Assessment', () => {
    it('should identify non-recoverable errors', () => {
      const nonRecoverableErrors = [
        new FileAccessError('File not found', '/test/file.docx'),
        new UnsupportedFormatError('/test/file.pdf', 'pdf'),
        new CorruptedFileError('/test/file.docx')
      ];

      nonRecoverableErrors[0].code = 'FILE_NOT_FOUND' as any;
      nonRecoverableErrors[1].code = 'UNSUPPORTED_FORMAT' as any;
      nonRecoverableErrors[2].code = 'CORRUPTED_FILE' as any;

      nonRecoverableErrors.forEach(error => {
        expect(errorHandler.isRecoverable(error)).toBe(false);
      });
    });

    it('should identify recoverable errors', () => {
      const recoverableErrors = [
        new ProcessingError('Processing failed', 'content_processing'),
        new SystemError('Temporary system error'),
        new ValidationError('Invalid input', 'field', 'value')
      ];

      recoverableErrors.forEach(error => {
        expect(errorHandler.isRecoverable(error)).toBe(true);
      });
    });
  });

  describe('Recovery Suggestions', () => {
    it('should provide suggestions for file not found errors', () => {
      const error = new FileAccessError('File not found', '/test/file.docx');
      error.code = 'FILE_NOT_FOUND' as any;

      const suggestions = errorHandler.getRecoverySuggestions(error);
      expect(suggestions).toContain('Check if the file still exists in the original location');
      expect(suggestions).toContain('Try selecting the file again');
    });

    it('should provide suggestions for memory errors', () => {
      const error = new MemoryError('Out of memory');

      const suggestions = errorHandler.getRecoverySuggestions(error);
      expect(suggestions).toContain('Close other applications to free up memory');
      expect(suggestions).toContain('Try processing smaller files or fewer files at once');
    });

    it('should provide default suggestions for unknown errors', () => {
      const error = new SystemError('Unknown error');
      error.code = 'UNKNOWN_ERROR' as any;

      const suggestions = errorHandler.getRecoverySuggestions(error);
      expect(suggestions).toContain('Try the operation again');
      expect(suggestions).toContain('Restart the application if the problem persists');
    });
  });

  describe('Batch Error Handling', () => {
    it('should handle multiple errors and determine continuation strategy', () => {
      const errors = [
        new FileAccessError('File not found', '/test/file1.docx'),
        new ParsingError('Parse error', '/test/file2.docx'),
        new ProcessingError('Processing error', 'content_processing')
      ];

      errors[0].code = 'FILE_NOT_FOUND' as any;
      errors[1].code = 'DOCUMENT_PARSING_ERROR' as any;
      errors[2].code = 'CONTENT_PROCESSING_ERROR' as any;

      const context = errorHandler.createErrorContext('batch_processing');
      const result = errorHandler.handleBatchError(errors, context);

      expect(result.shouldContinue).toBe(true);
      expect(result.recoveryActions).toHaveLength(3);
      expect(result.recoveryActions[0]).toBe(RecoveryAction.SKIP);
      expect(result.recoveryActions[1]).toBe(RecoveryAction.FALLBACK);
      expect(result.recoveryActions[2]).toBe(RecoveryAction.FALLBACK);
      expect(result.userMessage).toContain('Multiple errors occurred');
    });

    it('should stop continuation for critical system errors', () => {
      const errors = [
        new MemoryError('Critical memory error')
      ];

      const context = errorHandler.createErrorContext('batch_processing');
      const result = errorHandler.handleBatchError(errors, context);

      expect(result.shouldContinue).toBe(false);
      expect(result.recoveryActions[0]).toBe(RecoveryAction.RETRY);
    });
  });

  describe('Error Context Creation', () => {
    it('should create error context with operation and timestamp', () => {
      const context = errorHandler.createErrorContext('test_operation', { key: 'value' });

      expect(context.operation).toBe('test_operation');
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.additionalInfo).toEqual({ key: 'value' });
    });

    it('should include user agent in browser environment', () => {
      // Mock navigator
      const mockNavigator = { userAgent: 'Test User Agent' };
      (global as any).navigator = mockNavigator;

      const context = errorHandler.createErrorContext('test_operation');
      expect(context.userAgent).toBe('Test User Agent');

      // Clean up
      delete (global as any).navigator;
    });
  });

  describe('Statistics Management', () => {
    it('should clear error statistics', () => {
      // Add some errors
      const error = new ValidationError('Test error', 'field', 'value');
      const context = errorHandler.createErrorContext('test_operation');
      errorHandler.logError(error, context);

      // Verify stats exist
      let stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1);

      // Clear stats
      errorHandler.clearErrorStats();

      // Verify stats are cleared
      stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.recentErrors).toHaveLength(0);
    });
  });
});

describe('Global Error Handler', () => {
  it('should be a singleton instance', () => {
    expect(globalErrorHandler).toBeInstanceOf(CentralizedErrorHandler);
  });

  it('should maintain state across imports', () => {
    const error = new ValidationError('Test error', 'field', 'value');
    const context = globalErrorHandler.createErrorContext('test_operation');
    
    globalErrorHandler.logError(error, context);
    
    const stats = globalErrorHandler.getErrorStats();
    expect(stats.totalErrors).toBeGreaterThan(0);
  });
});