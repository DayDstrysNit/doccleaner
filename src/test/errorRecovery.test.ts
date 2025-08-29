import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorRecoveryService,
  RetryStrategy,
  FormatFallbackStrategy,
  MemoryOptimizationStrategy,
  GracefulDegradationStrategy,
  SkipStrategy,
  errorRecoveryService
} from '../services/errorRecovery';
import {
  FileAccessError,
  ParsingError,
  ProcessingError,
  SystemError,
  MemoryError,
  UnsupportedFormatError,
  CorruptedFileError,
  RecoveryAction
} from '../models/errors';
import { ProcessingOptions } from '../models';

describe('ErrorRecoveryService', () => {
  let recoveryService: ErrorRecoveryService;

  beforeEach(() => {
    recoveryService = new ErrorRecoveryService();
  });

  describe('Strategy Registration', () => {
    it('should register custom strategies', () => {
      const customStrategy = {
        canHandle: () => true,
        execute: async () => ({
          success: true,
          action: RecoveryAction.RETRY,
          message: 'Custom recovery',
          shouldRetry: true
        })
      };

      const initialStrategies = recoveryService.getStrategies();
      recoveryService.registerStrategy(customStrategy);
      const updatedStrategies = recoveryService.getStrategies();

      expect(updatedStrategies.length).toBe(initialStrategies.length + 1);
    });
  });

  describe('Recovery Context Creation', () => {
    it('should create recovery context with defaults', () => {
      const context = recoveryService.createRecoveryContext('test_operation');

      expect(context.operation).toBe('test_operation');
      expect(context.attemptNumber).toBe(1);
      expect(context.maxAttempts).toBe(3);
    });

    it('should create recovery context with custom options', () => {
      const options = {
        filePath: '/test/file.docx',
        originalOptions: { outputFormat: 'html' } as ProcessingOptions,
        attemptNumber: 2,
        maxAttempts: 5,
        additionalData: { key: 'value' }
      };

      const context = recoveryService.createRecoveryContext('test_operation', options);

      expect(context.operation).toBe('test_operation');
      expect(context.filePath).toBe('/test/file.docx');
      expect(context.originalOptions).toEqual(options.originalOptions);
      expect(context.attemptNumber).toBe(2);
      expect(context.maxAttempts).toBe(5);
      expect(context.additionalData).toEqual({ key: 'value' });
    });
  });

  describe('Recovery Execution', () => {
    it('should find and execute appropriate strategy', async () => {
      const error = new UnsupportedFormatError('/test/file.pdf', 'pdf');
      const context = recoveryService.createRecoveryContext('test_operation');

      const result = await recoveryService.attemptRecovery(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.SKIP);
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle case when no strategy is found', async () => {
      // Create a custom error that no strategy handles
      const error = new SystemError('Unknown error');
      error.code = 'UNKNOWN_CUSTOM_ERROR' as any;
      
      const context = recoveryService.createRecoveryContext('test_operation');

      const result = await recoveryService.attemptRecovery(error, context);

      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle strategy execution failures', async () => {
      const failingStrategy = {
        canHandle: () => true,
        execute: async () => {
          throw new Error('Strategy failed');
        }
      };

      recoveryService.registerStrategy(failingStrategy);

      const error = new SystemError('Test error');
      const context = recoveryService.createRecoveryContext('test_operation');

      const result = await recoveryService.attemptRecovery(error, context);

      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.message).toContain('Recovery failed');
    });
  });

  describe('Execute with Recovery', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context = recoveryService.createRecoveryContext('test_operation');

      const result = await recoveryService.executeWithRecovery(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry operation after recoverable error', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new SystemError('Temporary error'))
        .mockResolvedValue('success');

      const context = recoveryService.createRecoveryContext('test_operation', { maxAttempts: 3 });
      const onError = vi.fn();

      const result = await recoveryService.executeWithRecovery(operation, context, onError);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const error = new SystemError('Persistent error');
      const operation = vi.fn().mockRejectedValue(error);
      const context = recoveryService.createRecoveryContext('test_operation', { maxAttempts: 2 });

      await expect(recoveryService.executeWithRecovery(operation, context)).rejects.toThrow('Persistent error');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should convert non-AppError to SystemError', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Regular error'));
      const context = recoveryService.createRecoveryContext('test_operation', { maxAttempts: 1 });

      await expect(recoveryService.executeWithRecovery(operation, context)).rejects.toThrow('Unexpected error: Regular error');
    });
  });
});

describe('RetryStrategy', () => {
  let strategy: RetryStrategy;

  beforeEach(() => {
    strategy = new RetryStrategy(3, 100); // 3 retries, 100ms delay
  });

  describe('Error Handling', () => {
    it('should handle retryable errors', () => {
      const retryableErrors = [
        new SystemError('System error'),
        new ProcessingError('Processing error', 'content_processing'),
        new FileAccessError('Access error', '/test/file.docx')
      ];

      retryableErrors.forEach(error => {
        expect(strategy.canHandle(error)).toBe(true);
      });
    });

    it('should not handle file not found errors', () => {
      const error = new FileAccessError('File not found', '/test/file.docx');
      error.code = 'FILE_NOT_FOUND' as any;

      expect(strategy.canHandle(error)).toBe(false);
    });
  });

  describe('Recovery Execution', () => {
    it('should allow retry within max attempts', async () => {
      const error = new SystemError('Test error');
      const context = {
        operation: 'test',
        attemptNumber: 2,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.RETRY);
      expect(result.shouldRetry).toBe(true);
    });

    it('should abort after max attempts', async () => {
      const error = new SystemError('Test error');
      const context = {
        operation: 'test',
        attemptNumber: 3,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.shouldRetry).toBe(false);
    });
  });
});

describe('FormatFallbackStrategy', () => {
  let strategy: FormatFallbackStrategy;

  beforeEach(() => {
    strategy = new FormatFallbackStrategy();
  });

  describe('Error Handling', () => {
    it('should handle format conversion errors', () => {
      const error = new ProcessingError('Conversion failed', 'format_conversion');
      error.code = 'FORMAT_CONVERSION_ERROR' as any;

      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle other errors', () => {
      const error = new SystemError('System error');
      expect(strategy.canHandle(error)).toBe(false);
    });
  });

  describe('Recovery Execution', () => {
    it('should provide fallback format options', async () => {
      const error = new ProcessingError('HTML conversion failed', 'format_conversion');
      error.code = 'FORMAT_CONVERSION_ERROR' as any;
      
      const originalOptions: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      const context = {
        operation: 'format_conversion',
        originalOptions,
        attemptNumber: 1,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.modifiedOptions?.outputFormat).toBe('markdown');
      expect(result.shouldRetry).toBe(true);
    });

    it('should fail when no original options available', async () => {
      const error = new ProcessingError('Conversion failed', 'format_conversion');
      error.code = 'FORMAT_CONVERSION_ERROR' as any;
      
      const context = {
        operation: 'format_conversion',
        attemptNumber: 1,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.SKIP);
      expect(result.shouldRetry).toBe(false);
    });
  });
});

describe('MemoryOptimizationStrategy', () => {
  let strategy: MemoryOptimizationStrategy;

  beforeEach(() => {
    strategy = new MemoryOptimizationStrategy();
  });

  describe('Error Handling', () => {
    it('should handle memory errors', () => {
      const error = new MemoryError('Out of memory');
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle other errors', () => {
      const error = new SystemError('System error');
      expect(strategy.canHandle(error)).toBe(false);
    });
  });

  describe('Recovery Execution', () => {
    it('should optimize processing options for memory', async () => {
      const error = new MemoryError('Out of memory');
      const originalOptions: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: true,
        cleanupLevel: 'minimal',
        customSettings: { batchSize: 10 }
      };

      const context = {
        operation: 'processing',
        originalOptions,
        attemptNumber: 1,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.modifiedOptions?.preserveImages).toBe(false);
      expect(result.modifiedOptions?.cleanupLevel).toBe('aggressive');
      expect(result.modifiedOptions?.customSettings?.batchSize).toBe(1);
      expect(result.shouldRetry).toBe(true);
    });
  });
});

describe('GracefulDegradationStrategy', () => {
  let strategy: GracefulDegradationStrategy;

  beforeEach(() => {
    strategy = new GracefulDegradationStrategy();
  });

  describe('Error Handling', () => {
    it('should handle document parsing errors', () => {
      const error = new ParsingError('Parse failed', '/test/file.docx');
      error.code = 'DOCUMENT_PARSING_ERROR' as any;

      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle other parsing errors', () => {
      const error = new UnsupportedFormatError('/test/file.pdf', 'pdf');
      expect(strategy.canHandle(error)).toBe(false);
    });
  });

  describe('Recovery Execution', () => {
    it('should apply graceful degradation options', async () => {
      const error = new ParsingError('Complex structure failed', '/test/file.docx');
      error.code = 'DOCUMENT_PARSING_ERROR' as any;
      
      const originalOptions: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: true,
        includeMetadata: true,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      const context = {
        operation: 'parsing',
        originalOptions,
        attemptNumber: 1,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.modifiedOptions?.cleanupLevel).toBe('minimal');
      expect(result.modifiedOptions?.customSettings?.ignoreComplexStructures).toBe(true);
      expect(result.modifiedOptions?.customSettings?.extractTextOnly).toBe(true);
      expect(result.shouldRetry).toBe(true);
    });
  });
});

describe('SkipStrategy', () => {
  let strategy: SkipStrategy;

  beforeEach(() => {
    strategy = new SkipStrategy();
  });

  describe('Error Handling', () => {
    it('should handle non-recoverable errors', () => {
      const nonRecoverableErrors = [
        new FileAccessError('File not found', '/test/file.docx'),
        new UnsupportedFormatError('/test/file.pdf', 'pdf'),
        new CorruptedFileError('/test/file.docx')
      ];

      nonRecoverableErrors[0].code = 'FILE_NOT_FOUND' as any;
      nonRecoverableErrors[1].code = 'UNSUPPORTED_FORMAT' as any;
      nonRecoverableErrors[2].code = 'CORRUPTED_FILE' as any;

      nonRecoverableErrors.forEach(error => {
        expect(strategy.canHandle(error)).toBe(true);
      });
    });

    it('should not handle recoverable errors', () => {
      const error = new SystemError('System error');
      expect(strategy.canHandle(error)).toBe(false);
    });
  });

  describe('Recovery Execution', () => {
    it('should skip non-recoverable errors', async () => {
      const error = new UnsupportedFormatError('/test/file.pdf', 'pdf');
      const context = {
        operation: 'parsing',
        filePath: '/test/file.pdf',
        attemptNumber: 1,
        maxAttempts: 3,
        additionalData: undefined
      };

      const result = await strategy.execute(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.SKIP);
      expect(result.shouldRetry).toBe(false);
      expect(result.message).toContain('non-recoverable error');
    });
  });
});

describe('Global Error Recovery Service', () => {
  it('should be a singleton instance', () => {
    expect(errorRecoveryService).toBeInstanceOf(ErrorRecoveryService);
  });

  it('should have default strategies registered', () => {
    const strategies = errorRecoveryService.getStrategies();
    expect(strategies).toContain('SkipStrategy');
    expect(strategies).toContain('RetryStrategy');
    expect(strategies).toContain('FormatFallbackStrategy');
    expect(strategies).toContain('MemoryOptimizationStrategy');
    expect(strategies).toContain('GracefulDegradationStrategy');
  });
});