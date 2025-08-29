// Error types and error handling interfaces

// Base error class for application errors
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Error categories
export enum ErrorCategory {
  FILE_ACCESS = 'FILE_ACCESS',
  PARSING = 'PARSING',
  PROCESSING = 'PROCESSING',
  OUTPUT = 'OUTPUT',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM'
}

// File access errors
export class FileAccessError extends AppError {
  readonly code = 'FILE_ACCESS_ERROR';
  readonly category = ErrorCategory.FILE_ACCESS;
  
  constructor(message: string, public readonly filePath: string, cause?: Error) {
    super(message, cause);
  }
}

export class FileNotFoundError extends FileAccessError {
  readonly code = 'FILE_NOT_FOUND';
  
  constructor(filePath: string) {
    super(`File not found: ${filePath}`, filePath);
  }
}

export class FilePermissionError extends FileAccessError {
  readonly code = 'FILE_PERMISSION_ERROR';
  
  constructor(filePath: string, operation: 'read' | 'write') {
    super(`Permission denied for ${operation} operation on: ${filePath}`, filePath);
  }
}

// Parsing errors
export class ParsingError extends AppError {
  readonly code = 'PARSING_ERROR';
  readonly category = ErrorCategory.PARSING;
  
  constructor(message: string, public readonly filePath: string, cause?: Error) {
    super(message, cause);
  }
}

export class UnsupportedFormatError extends ParsingError {
  readonly code = 'UNSUPPORTED_FORMAT';
  
  constructor(filePath: string, format: string) {
    super(`Unsupported file format: ${format} for file: ${filePath}`, filePath);
  }
}

export class CorruptedFileError extends ParsingError {
  readonly code = 'CORRUPTED_FILE';
  
  constructor(filePath: string) {
    super(`File appears to be corrupted: ${filePath}`, filePath);
  }
}

export class DocumentParsingError extends ParsingError {
  readonly code = 'DOCUMENT_PARSING_ERROR';
  
  constructor(message: string, filePath: string, cause?: Error) {
    super(message, filePath, cause);
  }
}

// Processing errors
export class ProcessingError extends AppError {
  readonly code = 'PROCESSING_ERROR';
  readonly category = ErrorCategory.PROCESSING;
  
  constructor(message: string, public readonly stage: string, cause?: Error) {
    super(message, cause);
  }
}

export class ContentProcessingError extends ProcessingError {
  readonly code = 'CONTENT_PROCESSING_ERROR';
  
  constructor(stage: string, details: string) {
    super(`Content processing failed at stage: ${stage}. ${details}`, stage);
  }
}

export class FormatConversionError extends ProcessingError {
  readonly code = 'FORMAT_CONVERSION_ERROR';
  
  constructor(targetFormat: string, details: string) {
    super(`Failed to convert to ${targetFormat}: ${details}`, 'format_conversion');
  }
}

// Output errors
export class OutputError extends AppError {
  readonly code = 'OUTPUT_ERROR';
  readonly category = ErrorCategory.OUTPUT;
  
  constructor(message: string, public readonly outputPath?: string, cause?: Error) {
    super(message, cause);
  }
}

export class DiskSpaceError extends OutputError {
  readonly code = 'DISK_SPACE_ERROR';
  
  constructor(outputPath: string) {
    super(`Insufficient disk space for output: ${outputPath}`, outputPath);
  }
}

// Validation errors
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
  
  constructor(message: string, public readonly field: string, public readonly value: any) {
    super(message);
  }
}

// System errors
export class SystemError extends AppError {
  readonly code = 'SYSTEM_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

export class MemoryError extends SystemError {
  readonly code = 'MEMORY_ERROR';
  
  constructor(operation: string) {
    super(`Insufficient memory for operation: ${operation}`);
  }
}

// Recovery action types
export enum RecoveryAction {
  RETRY = 'RETRY',
  SKIP = 'SKIP',
  ABORT = 'ABORT',
  FALLBACK = 'FALLBACK',
  USER_INPUT = 'USER_INPUT'
}

// Error context interface
export interface ErrorContext {
  operation: string;
  filePath?: string;
  timestamp: Date;
  userAgent?: string;
  additionalInfo?: Record<string, any>;
}

// Error handler interface
export interface ErrorHandler {
  /**
   * Handle parsing errors with recovery strategy
   */
  handleParsingError(error: ParsingError, file: File): RecoveryAction;
  
  /**
   * Handle processing errors with recovery strategy
   */
  handleProcessingError(error: ProcessingError): RecoveryAction;
  
  /**
   * Handle file access errors
   */
  handleFileAccessError(error: FileAccessError): RecoveryAction;
  
  /**
   * Log error with context information
   */
  logError(error: AppError, context: ErrorContext): void;
  
  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: AppError): string;
  
  /**
   * Check if error is recoverable
   */
  isRecoverable(error: AppError): boolean;
}

// Error reporting interface
export interface ErrorReporter {
  /**
   * Report error for debugging/monitoring
   */
  reportError(error: AppError, context: ErrorContext): void;
  
  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats;
}

// Error statistics interface
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByCode: Record<string, number>;
  recentErrors: Array<{ error: AppError; context: ErrorContext; timestamp: Date }>;
}