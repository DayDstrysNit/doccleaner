// Service layer interfaces and implementations

import {
  DocumentModel,
  StructuredContent,
  ProcessingOptions,
  BatchResult,
  ProcessingProgress,
  FileProcessingResult
} from '../models';

// Export implementations
export { MammothDocumentParser } from './documentParser';
export { WordContentProcessor } from './contentProcessor';
export { ConcurrentBatchProcessor } from './batchProcessor';
export { MultiFormatConverter } from './formatConverter';
export { CentralizedErrorHandler, globalErrorHandler } from './errorHandler';
export { Logger, logger, performanceLogger, LogLevel, LogCategories } from './logger';
export { ErrorRecoveryService, errorRecoveryService } from './errorRecovery';
export { SettingsService, LocalStorageSettingsService, settingsService } from './settingsService';

// Document parser service interface
export interface DocumentParser {
  /**
   * Parse a DOCX document from file path
   */
  parseDocument(filePath: string): Promise<DocumentModel>;
  
  /**
   * Validate if a file is a supported document format
   */
  validateDocument(filePath: string): Promise<boolean>;
  
  /**
   * Get list of supported file formats
   */
  getSupportedFormats(): string[];
  
  /**
   * Check if a file extension is supported
   */
  isFormatSupported(extension: string): boolean;
}

// Content processor service interface
export interface ContentProcessor {
  /**
   * Clean content by removing Word-specific formatting
   */
  cleanContent(document: DocumentModel): Promise<StructuredContent>;
  
  /**
   * Preserve document structure while cleaning formatting
   */
  preserveStructure(document: DocumentModel): StructuredContent;
  
  /**
   * Strip all formatting from content string
   */
  stripFormatting(content: string): string;
  
  /**
   * Extract and clean text content only
   */
  extractTextContent(document: DocumentModel): string;
}

// Format converter service interface
export interface FormatConverter {
  /**
   * Convert structured content to plain text
   */
  toPlainText(content: StructuredContent): string;
  
  /**
   * Convert structured content to HTML
   */
  toHTML(content: StructuredContent): string;
  
  /**
   * Convert structured content to Markdown
   */
  toMarkdown(content: StructuredContent): string;
  
  /**
   * Convert to custom format based on options
   */
  toCustomFormat(content: StructuredContent, options: ProcessingOptions): string;
  
  /**
   * Get available output formats
   */
  getAvailableFormats(): string[];
}

// Batch processor service interface
export interface BatchProcessor {
  /**
   * Process multiple files with given options
   */
  processFiles(files: File[], options: ProcessingOptions): Promise<BatchResult>;
  
  /**
   * Process files from file paths
   */
  processFilePaths(filePaths: string[], options: ProcessingOptions): Promise<BatchResult>;
  
  /**
   * Get current processing progress
   */
  getProgress(): ProcessingProgress;
  
  /**
   * Cancel ongoing processing
   */
  cancelProcessing(): void;
  
  /**
   * Check if processing is currently active
   */
  isProcessing(): boolean;
}

// File system utilities interface
export interface FileSystemUtils {
  /**
   * Read file securely with validation
   */
  readFile(filePath: string): Promise<Buffer>;
  
  /**
   * Write file with proper error handling
   */
  writeFile(filePath: string, content: string): Promise<void>;
  
  /**
   * Validate file path and permissions
   */
  validateFilePath(filePath: string): Promise<boolean>;
  
  /**
   * Clean up temporary files
   */
  cleanupTempFiles(tempPaths: string[]): Promise<void>;
  
  /**
   * Get file metadata
   */
  getFileMetadata(filePath: string): Promise<{ size: number; created: Date; modified: Date }>;
}
