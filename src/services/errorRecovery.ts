import {
  AppError,
  RecoveryAction,
  ParsingError,
  ProcessingError,
  FileAccessError,
  SystemError,
  ErrorContext
} from '../models/errors';
import { ProcessingOptions } from '../models';
import { logger, LogCategories } from './logger';

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  canHandle(error: AppError): boolean;
  execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult>;
}

/**
 * Recovery context with operation details
 */
export interface RecoveryContext {
  operation: string;
  filePath?: string;
  originalOptions?: ProcessingOptions;
  attemptNumber: number;
  maxAttempts: number;
  additionalData?: any;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  modifiedOptions?: ProcessingOptions;
  fallbackData?: any;
  shouldRetry: boolean;
}

/**
 * Retry strategy for transient errors
 */
export class RetryStrategy implements RecoveryStrategy {
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(maxRetries: number = 3, retryDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  canHandle(error: AppError): boolean {
    // Retry for system errors, some processing errors, and temporary file access issues
    const retryableErrors = [
      'SYSTEM_ERROR',
      'PROCESSING_ERROR',
      'CONTENT_PROCESSING_ERROR',
      'FILE_ACCESS_ERROR'
    ];
    
    return retryableErrors.includes(error.code) && 
           !(error instanceof FileAccessError && error.code === 'FILE_NOT_FOUND');
  }

  async execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult> {
    if (context.attemptNumber >= this.maxRetries) {
      logger.warn(LogCategories.ERROR_HANDLING, 
        `Max retry attempts reached for ${error.code}`, 
        { error: error.message, context }
      );
      
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: `Failed after ${this.maxRetries} attempts: ${error.message}`,
        shouldRetry: false
      };
    }

    // Wait before retrying
    if (context.attemptNumber > 1) {
      await this.delay(this.retryDelay * context.attemptNumber);
    }

    logger.info(LogCategories.ERROR_HANDLING, 
      `Retrying operation after ${error.code}`, 
      { attempt: context.attemptNumber, maxAttempts: this.maxRetries }
    );

    return {
      success: true,
      action: RecoveryAction.RETRY,
      message: `Retrying operation (attempt ${context.attemptNumber}/${this.maxRetries})`,
      shouldRetry: true
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Fallback strategy for format conversion errors
 */
export class FormatFallbackStrategy implements RecoveryStrategy {
  canHandle(error: AppError): boolean {
    return error.code === 'FORMAT_CONVERSION_ERROR';
  }

  async execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult> {
    const originalOptions = context.originalOptions;
    if (!originalOptions) {
      return {
        success: false,
        action: RecoveryAction.SKIP,
        message: 'No original options available for fallback',
        shouldRetry: false
      };
    }

    // Try fallback formats
    const formatFallbacks: Record<string, string[]> = {
      'html': ['markdown', 'plaintext'],
      'markdown': ['plaintext', 'html'],
      'plaintext': ['html', 'markdown']
    };

    const fallbackFormats = formatFallbacks[originalOptions.outputFormat] || ['plaintext'];
    const nextFormat = fallbackFormats[0];

    if (!nextFormat) {
      return {
        success: false,
        action: RecoveryAction.SKIP,
        message: 'No fallback format available',
        shouldRetry: false
      };
    }

    const modifiedOptions: ProcessingOptions = {
      ...originalOptions,
      outputFormat: nextFormat as 'html' | 'markdown' | 'plaintext'
    };

    logger.info(LogCategories.ERROR_HANDLING, 
      `Using fallback format: ${nextFormat}`, 
      { originalFormat: originalOptions.outputFormat, fallbackFormat: nextFormat }
    );

    return {
      success: true,
      action: RecoveryAction.FALLBACK,
      message: `Trying fallback format: ${nextFormat}`,
      modifiedOptions,
      shouldRetry: true
    };
  }
}

/**
 * Memory optimization strategy for memory errors
 */
export class MemoryOptimizationStrategy implements RecoveryStrategy {
  canHandle(error: AppError): boolean {
    return error.code === 'MEMORY_ERROR';
  }

  async execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult> {
    const originalOptions = context.originalOptions;
    if (!originalOptions) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: 'Cannot optimize memory without original options',
        shouldRetry: false
      };
    }

    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }

    // Modify options to use less memory
    const modifiedOptions: ProcessingOptions = {
      ...originalOptions,
      preserveImages: false, // Disable image processing to save memory
      cleanupLevel: 'aggressive', // Use more aggressive cleanup
      customSettings: {
        ...originalOptions.customSettings,
        batchSize: 1, // Process one file at a time
        enableMemoryOptimization: true
      }
    };

    logger.info(LogCategories.ERROR_HANDLING, 
      'Applying memory optimization strategy', 
      { modifications: 'disabled images, aggressive cleanup, batch size 1' }
    );

    return {
      success: true,
      action: RecoveryAction.FALLBACK,
      message: 'Retrying with memory optimization',
      modifiedOptions,
      shouldRetry: true
    };
  }
}

/**
 * Graceful degradation strategy for parsing errors
 */
export class GracefulDegradationStrategy implements RecoveryStrategy {
  canHandle(error: AppError): boolean {
    return error instanceof ParsingError && error.code === 'DOCUMENT_PARSING_ERROR';
  }

  async execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult> {
    const originalOptions = context.originalOptions;
    if (!originalOptions) {
      return {
        success: false,
        action: RecoveryAction.SKIP,
        message: 'Cannot apply graceful degradation without original options',
        shouldRetry: false
      };
    }

    // Try with more lenient parsing options
    const modifiedOptions: ProcessingOptions = {
      ...originalOptions,
      cleanupLevel: 'minimal', // Use minimal cleanup to avoid processing complex structures
      customSettings: {
        ...originalOptions.customSettings,
        ignoreComplexStructures: true,
        skipImages: true,
        skipTables: true,
        extractTextOnly: true
      }
    };

    logger.info(LogCategories.ERROR_HANDLING, 
      'Applying graceful degradation strategy', 
      { modifications: 'minimal cleanup, text-only extraction' }
    );

    return {
      success: true,
      action: RecoveryAction.FALLBACK,
      message: 'Retrying with simplified parsing (text-only)',
      modifiedOptions,
      shouldRetry: true
    };
  }
}

/**
 * Skip strategy for non-recoverable errors
 */
export class SkipStrategy implements RecoveryStrategy {
  canHandle(error: AppError): boolean {
    const nonRecoverableErrors = [
      'FILE_NOT_FOUND',
      'UNSUPPORTED_FORMAT',
      'CORRUPTED_FILE',
      'DISK_SPACE_ERROR'
    ];
    
    return nonRecoverableErrors.includes(error.code);
  }

  async execute(error: AppError, context: RecoveryContext): Promise<RecoveryResult> {
    logger.info(LogCategories.ERROR_HANDLING, 
      `Skipping non-recoverable error: ${error.code}`, 
      { error: error.message, filePath: context.filePath }
    );

    return {
      success: true,
      action: RecoveryAction.SKIP,
      message: `Skipping due to non-recoverable error: ${error.message}`,
      shouldRetry: false
    };
  }
}

/**
 * Main error recovery service
 */
export class ErrorRecoveryService {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    // Register default strategies in order of preference
    this.strategies = [
      new SkipStrategy(),
      new RetryStrategy(),
      new FormatFallbackStrategy(),
      new MemoryOptimizationStrategy(),
      new GracefulDegradationStrategy()
    ];
  }

  /**
   * Register a custom recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.unshift(strategy); // Add to beginning for higher priority
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    error: AppError, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    logger.info(LogCategories.ERROR_HANDLING, 
      `Attempting recovery for error: ${error.code}`, 
      { error: error.message, context }
    );

    // Find the first strategy that can handle this error
    const strategy = this.strategies.find(s => s.canHandle(error));
    
    if (!strategy) {
      logger.warn(LogCategories.ERROR_HANDLING, 
        `No recovery strategy found for error: ${error.code}`, 
        { error: error.message }
      );
      
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: `No recovery strategy available for: ${error.message}`,
        shouldRetry: false
      };
    }

    try {
      const result = await strategy.execute(error, context);
      
      logger.info(LogCategories.ERROR_HANDLING, 
        `Recovery strategy executed: ${strategy.constructor.name}`, 
        { success: result.success, action: result.action, message: result.message }
      );
      
      return result;
    } catch (recoveryError) {
      logger.error(LogCategories.ERROR_HANDLING, 
        `Recovery strategy failed: ${strategy.constructor.name}`, 
        recoveryError as Error,
        { originalError: error.message }
      );
      
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: `Recovery failed: ${(recoveryError as Error).message}`,
        shouldRetry: false
      };
    }
  }

  /**
   * Create recovery context
   */
  createRecoveryContext(
    operation: string,
    options?: {
      filePath?: string;
      originalOptions?: ProcessingOptions;
      attemptNumber?: number;
      maxAttempts?: number;
      additionalData?: any;
    }
  ): RecoveryContext {
    return {
      operation,
      filePath: options?.filePath,
      originalOptions: options?.originalOptions,
      attemptNumber: options?.attemptNumber || 1,
      maxAttempts: options?.maxAttempts || 3,
      additionalData: options?.additionalData
    };
  }

  /**
   * Execute operation with automatic recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: RecoveryContext,
    onError?: (error: AppError, recoveryResult: RecoveryResult) => void
  ): Promise<T> {
    let lastError: AppError | null = null;
    let currentContext = { ...context };

    for (let attempt = 1; attempt <= context.maxAttempts; attempt++) {
      currentContext.attemptNumber = attempt;

      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof AppError)) {
          // Convert unknown errors to AppError
          lastError = new SystemError(`Unexpected error: ${(error as Error).message}`, error as Error);
        } else {
          lastError = error;
        }

        logger.warn(LogCategories.ERROR_HANDLING, 
          `Operation failed on attempt ${attempt}`, 
          lastError,
          { context: currentContext }
        );

        // Attempt recovery
        const recoveryResult = await this.attemptRecovery(lastError, currentContext);
        
        if (onError) {
          onError(lastError, recoveryResult);
        }

        if (!recoveryResult.shouldRetry || recoveryResult.action === RecoveryAction.ABORT) {
          break;
        }

        // Update context with recovery modifications
        if (recoveryResult.modifiedOptions) {
          currentContext.originalOptions = recoveryResult.modifiedOptions;
        }
      }
    }

    // If we get here, all recovery attempts failed
    throw lastError || new SystemError('Operation failed after all recovery attempts');
  }

  /**
   * Get available strategies
   */
  getStrategies(): string[] {
    return this.strategies.map(s => s.constructor.name);
  }
}

/**
 * Global error recovery service instance
 */
export const errorRecoveryService = new ErrorRecoveryService();