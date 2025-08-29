import {
  AppError,
  ErrorCategory,
  ErrorHandler,
  ErrorReporter,
  ErrorStats,
  ErrorContext,
  RecoveryAction,
  ParsingError,
  ProcessingError,
  FileAccessError,
  ValidationError,
  SystemError,
  OutputError
} from '../models/errors';

/**
 * Centralized error handling service with user-friendly messages and recovery strategies
 */
export class CentralizedErrorHandler implements ErrorHandler, ErrorReporter {
  private errorStats: ErrorStats;
  private recentErrors: Array<{ error: AppError; context: ErrorContext; timestamp: Date }> = [];
  private readonly maxRecentErrors = 100;

  constructor() {
    this.errorStats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsByCode: {},
      recentErrors: []
    };

    // Initialize error counters
    Object.values(ErrorCategory).forEach(category => {
      this.errorStats.errorsByCategory[category] = 0;
    });
  }

  /**
   * Handle parsing errors with recovery strategy
   */
  handleParsingError(error: ParsingError, file: File): RecoveryAction {
    const context: ErrorContext = {
      operation: 'document_parsing',
      filePath: error.filePath,
      timestamp: new Date(),
      additionalInfo: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      }
    };

    this.logError(error, context);

    // Determine recovery action based on error type
    switch (error.code) {
      case 'UNSUPPORTED_FORMAT':
        return RecoveryAction.SKIP;
      
      case 'CORRUPTED_FILE':
        return RecoveryAction.SKIP;
      
      case 'DOCUMENT_PARSING_ERROR':
        // Try fallback parsing method if available
        return RecoveryAction.FALLBACK;
      
      default:
        return RecoveryAction.RETRY;
    }
  }

  /**
   * Handle processing errors with recovery strategy
   */
  handleProcessingError(error: ProcessingError): RecoveryAction {
    const context: ErrorContext = {
      operation: 'content_processing',
      timestamp: new Date(),
      additionalInfo: {
        stage: error.stage
      }
    };

    this.logError(error, context);

    // Determine recovery action based on error type and stage
    switch (error.code) {
      case 'CONTENT_PROCESSING_ERROR':
        // Try with different processing options
        return RecoveryAction.FALLBACK;
      
      case 'FORMAT_CONVERSION_ERROR':
        // Skip this format and try others
        return RecoveryAction.FALLBACK;
      
      case 'MEMORY_ERROR':
        // Reduce batch size and retry
        return RecoveryAction.RETRY;
      
      default:
        return RecoveryAction.SKIP;
    }
  }

  /**
   * Handle file access errors
   */
  handleFileAccessError(error: FileAccessError): RecoveryAction {
    const context: ErrorContext = {
      operation: 'file_access',
      filePath: error.filePath,
      timestamp: new Date()
    };

    this.logError(error, context);

    switch (error.code) {
      case 'FILE_NOT_FOUND':
        return RecoveryAction.SKIP;
      
      case 'FILE_PERMISSION_ERROR':
        return RecoveryAction.USER_INPUT;
      
      default:
        return RecoveryAction.RETRY;
    }
  }

  /**
   * Log error with context information
   */
  logError(error: AppError, context: ErrorContext): void {
    // Update statistics
    this.errorStats.totalErrors++;
    this.errorStats.errorsByCategory[error.category]++;
    this.errorStats.errorsByCode[error.code] = (this.errorStats.errorsByCode[error.code] || 0) + 1;

    // Add to recent errors
    const errorEntry = { error, context, timestamp: new Date() };
    this.recentErrors.unshift(errorEntry);
    
    // Keep only the most recent errors
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }

    // Update stats reference
    this.errorStats.recentErrors = [...this.recentErrors];

    // Log to console with appropriate level
    this.logToConsole(error, context);
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: AppError): string {
    const baseMessages: Record<string, string> = {
      // File Access Errors
      'FILE_NOT_FOUND': 'The selected file could not be found. Please check if the file still exists.',
      'FILE_PERMISSION_ERROR': 'Permission denied. Please check if you have access to read this file.',
      'FILE_ACCESS_ERROR': 'Unable to access the file. Please try again or select a different file.',

      // Parsing Errors
      'UNSUPPORTED_FORMAT': 'This file format is not supported. Please select a DOCX file.',
      'CORRUPTED_FILE': 'The file appears to be corrupted or damaged. Please try with a different file.',
      'DOCUMENT_PARSING_ERROR': 'Unable to read the document content. The file may be corrupted or use unsupported features.',

      // Processing Errors
      'CONTENT_PROCESSING_ERROR': 'An error occurred while processing the document content. Please try again.',
      'FORMAT_CONVERSION_ERROR': 'Unable to convert the document to the selected format. Please try a different output format.',
      'PROCESSING_ERROR': 'An error occurred during document processing. Please try again.',

      // Output Errors
      'OUTPUT_ERROR': 'Unable to save the processed document. Please check your permissions and try again.',
      'DISK_SPACE_ERROR': 'Insufficient disk space to save the output. Please free up some space and try again.',

      // System Errors
      'MEMORY_ERROR': 'Not enough memory to process this document. Please try with a smaller file or restart the application.',
      'SYSTEM_ERROR': 'A system error occurred. Please try again or restart the application.',

      // Validation Errors
      'VALIDATION_ERROR': 'Invalid input provided. Please check your settings and try again.'
    };

    const friendlyMessage = baseMessages[error.code];
    if (friendlyMessage) {
      return friendlyMessage;
    }

    // Fallback to category-based messages
    switch (error.category) {
      case ErrorCategory.FILE_ACCESS:
        return 'There was a problem accessing the file. Please check the file path and permissions.';
      
      case ErrorCategory.PARSING:
        return 'Unable to read the document. Please ensure it\'s a valid DOCX file.';
      
      case ErrorCategory.PROCESSING:
        return 'An error occurred while processing the document. Please try again.';
      
      case ErrorCategory.OUTPUT:
        return 'Unable to save the processed document. Please check your permissions.';
      
      case ErrorCategory.VALIDATION:
        return 'Invalid input provided. Please check your settings.';
      
      case ErrorCategory.SYSTEM:
        return 'A system error occurred. Please try again or restart the application.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: AppError): boolean {
    const nonRecoverableErrors = [
      'FILE_NOT_FOUND',
      'UNSUPPORTED_FORMAT',
      'CORRUPTED_FILE',
      'DISK_SPACE_ERROR'
    ];

    return !nonRecoverableErrors.includes(error.code);
  }

  /**
   * Report error for debugging/monitoring
   */
  reportError(error: AppError, context: ErrorContext): void {
    // In a production environment, this could send errors to a monitoring service
    // For now, we'll just ensure it's logged
    this.logError(error, context);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    return {
      ...this.errorStats,
      recentErrors: [...this.recentErrors]
    };
  }

  /**
   * Clear error statistics
   */
  clearErrorStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsByCode: {},
      recentErrors: []
    };

    Object.values(ErrorCategory).forEach(category => {
      this.errorStats.errorsByCategory[category] = 0;
    });

    this.recentErrors = [];
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoverySuggestions(error: AppError): string[] {
    const suggestions: Record<string, string[]> = {
      'FILE_NOT_FOUND': [
        'Check if the file still exists in the original location',
        'Try selecting the file again',
        'Verify the file hasn\'t been moved or deleted'
      ],
      
      'FILE_PERMISSION_ERROR': [
        'Check if you have read permissions for the file',
        'Try running the application as administrator',
        'Ensure the file is not open in another application'
      ],
      
      'UNSUPPORTED_FORMAT': [
        'Convert the file to DOCX format using Microsoft Word',
        'Save the document as a DOCX file',
        'Check if the file extension is correct'
      ],
      
      'CORRUPTED_FILE': [
        'Try opening the file in Microsoft Word to check if it\'s readable',
        'Use a different copy of the file if available',
        'Try repairing the document using Word\'s built-in repair feature'
      ],
      
      'MEMORY_ERROR': [
        'Close other applications to free up memory',
        'Try processing smaller files or fewer files at once',
        'Restart the application to clear memory',
        'Consider processing files individually instead of in batch'
      ],
      
      'DISK_SPACE_ERROR': [
        'Free up disk space by deleting unnecessary files',
        'Choose a different output location with more space',
        'Clear temporary files and empty the recycle bin'
      ]
    };

    return suggestions[error.code] || [
      'Try the operation again',
      'Restart the application if the problem persists',
      'Check the application logs for more details'
    ];
  }

  /**
   * Log error to console with appropriate level
   */
  private logToConsole(error: AppError, context: ErrorContext): void {
    const logMessage = `[${error.category}] ${error.code}: ${error.message}`;
    const contextInfo = {
      operation: context.operation,
      filePath: context.filePath,
      timestamp: context.timestamp.toISOString(),
      ...context.additionalInfo
    };

    switch (error.category) {
      case ErrorCategory.SYSTEM:
      case ErrorCategory.PROCESSING:
        console.error(logMessage, contextInfo);
        if (error.cause) {
          console.error('Caused by:', error.cause);
        }
        break;
      
      case ErrorCategory.FILE_ACCESS:
      case ErrorCategory.PARSING:
        console.warn(logMessage, contextInfo);
        break;
      
      case ErrorCategory.VALIDATION:
        console.info(logMessage, contextInfo);
        break;
      
      default:
        console.log(logMessage, contextInfo);
    }
  }

  /**
   * Create error context for operations
   */
  createErrorContext(operation: string, additionalInfo?: Record<string, any>): ErrorContext {
    return {
      operation,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      additionalInfo
    };
  }

  /**
   * Handle batch processing errors with recovery strategies
   */
  handleBatchError(errors: AppError[], context: ErrorContext): {
    shouldContinue: boolean;
    recoveryActions: RecoveryAction[];
    userMessage: string;
  } {
    const recoveryActions: RecoveryAction[] = [];
    let shouldContinue = true;
    const errorMessages: string[] = [];

    for (const error of errors) {
      this.logError(error, context);
      
      if (error instanceof ParsingError) {
        recoveryActions.push(this.handleParsingError(error, {} as File));
      } else if (error instanceof ProcessingError) {
        recoveryActions.push(this.handleProcessingError(error));
      } else if (error instanceof FileAccessError) {
        recoveryActions.push(this.handleFileAccessError(error));
      } else if (error instanceof SystemError) {
        // Handle system errors (including MemoryError)
        if (error.code === 'MEMORY_ERROR') {
          recoveryActions.push(RecoveryAction.RETRY);
          shouldContinue = false; // Stop batch processing for critical memory errors
        } else {
          recoveryActions.push(RecoveryAction.RETRY);
        }
      } else {
        recoveryActions.push(RecoveryAction.SKIP);
      }

      errorMessages.push(this.getUserFriendlyMessage(error));

      // Check if we should abort the entire batch
      if (error instanceof SystemError && error.code === 'MEMORY_ERROR') {
        shouldContinue = false;
        break;
      }
    }

    const userMessage = errors.length === 1 
      ? errorMessages[0]
      : `Multiple errors occurred: ${errorMessages.slice(0, 3).join('; ')}${errors.length > 3 ? ` and ${errors.length - 3} more...` : ''}`;

    return {
      shouldContinue,
      recoveryActions,
      userMessage
    };
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new CentralizedErrorHandler();