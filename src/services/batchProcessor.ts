import {
  BatchProcessor,
  DocumentParser,
  ContentProcessor,
  ProcessingOptions,
  BatchResult,
  ProcessingProgress,
  FileProcessingResult,
  StructuredContent
} from './index';
import { MammothDocumentParser } from './documentParser';
import { WordContentProcessor } from './contentProcessor';
import {
  ProcessingError,
  FileAccessError,
  ParsingError,
  SystemError,
  MemoryError
} from '../models/errors';
import { globalErrorHandler } from './errorHandler';
import { logger, LogCategories, performanceLogger } from './logger';
import { errorRecoveryService } from './errorRecovery';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Implementation of BatchProcessor service for handling multiple files concurrently
 * with progress tracking and error handling
 */
export class ConcurrentBatchProcessor implements BatchProcessor {
  private documentParser: DocumentParser;
  private contentProcessor: ContentProcessor;
  private isCurrentlyProcessing: boolean = false;
  private currentProgress: ProcessingProgress;
  private shouldCancel: boolean = false;
  private readonly maxConcurrentFiles: number;
  private readonly memoryThreshold: number; // in MB

  constructor(
    maxConcurrentFiles: number = 3,
    memoryThreshold: number = 500 // 500MB
  ) {
    this.documentParser = new MammothDocumentParser();
    this.contentProcessor = new WordContentProcessor();
    this.maxConcurrentFiles = maxConcurrentFiles;
    this.memoryThreshold = memoryThreshold;
    this.currentProgress = this.createInitialProgress();
  }

  /**
   * Process multiple files with given options
   */
  async processFiles(files: File[], options: ProcessingOptions): Promise<BatchResult> {
    // Convert File objects to file paths for processing
    const filePaths = files.map(file => file.name);
    return this.processFilePaths(filePaths, options);
  }

  /**
   * Process files from file paths
   */
  async processFilePaths(filePaths: string[], options: ProcessingOptions): Promise<BatchResult> {
    if (this.isCurrentlyProcessing) {
      const error = new ProcessingError('Batch processing already in progress', 'batch_processing');
      globalErrorHandler.logError(error, globalErrorHandler.createErrorContext('batch_processing'));
      throw error;
    }

    this.isCurrentlyProcessing = true;
    this.shouldCancel = false;
    
    const operationId = `batch_${Date.now()}`;
    performanceLogger.startTimer(operationId, `Batch processing ${filePaths.length} files`);
    
    logger.info(LogCategories.BATCH_PROCESSING, 
      `Starting batch processing of ${filePaths.length} files`, 
      { fileCount: filePaths.length, options }
    );

    const startTime = Date.now();
    const results: FileProcessingResult[] = [];
    let successfulFiles = 0;
    let failedFiles = 0;

    try {
      // Initialize progress tracking
      this.initializeProgress(filePaths);

      // Validate all files before processing
      const validatedFiles = await this.validateFiles(filePaths);
      
      logger.info(LogCategories.BATCH_PROCESSING, 
        `Validated ${validatedFiles.length} of ${filePaths.length} files`, 
        { validFiles: validatedFiles.length, totalFiles: filePaths.length }
      );

      // Process files in batches to manage memory and concurrency
      const batches = this.createProcessingBatches(validatedFiles);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        if (this.shouldCancel) {
          logger.info(LogCategories.BATCH_PROCESSING, 'Batch processing cancelled by user');
          break;
        }

        logger.debug(LogCategories.BATCH_PROCESSING, 
          `Processing batch ${batchIndex + 1}/${batches.length}`, 
          { batchSize: batch.length, files: batch.map(f => path.basename(f)) }
        );

        // Check memory usage before processing batch
        performanceLogger.logMemoryUsage(`Before batch ${batchIndex + 1}`);
        await this.checkMemoryUsage();

        // Process batch concurrently
        const batchResults = await this.processBatch(batch, options);
        
        // Update results and progress
        for (const result of batchResults) {
          results.push(result);
          if (result.success) {
            successfulFiles++;
          } else {
            failedFiles++;
          }
          
          this.updateProgress(result.filename);
        }

        performanceLogger.logMemoryUsage(`After batch ${batchIndex + 1}`);
      }

      const totalProcessingTime = performanceLogger.endTimer(operationId, 
        `Batch processing completed: ${successfulFiles} successful, ${failedFiles} failed`
      );

      logger.info(LogCategories.BATCH_PROCESSING, 
        'Batch processing completed', 
        { 
          totalFiles: filePaths.length,
          successfulFiles,
          failedFiles,
          totalProcessingTime: `${totalProcessingTime}ms`
        }
      );

      return {
        totalFiles: filePaths.length,
        successfulFiles,
        failedFiles,
        results,
        totalProcessingTime
      };

    } catch (error) {
      performanceLogger.endTimer(operationId, 'Batch processing failed');
      
      const processingError = new ProcessingError(
        `Batch processing failed: ${(error as Error).message}`,
        'batch_processing',
        error as Error
      );
      
      globalErrorHandler.logError(processingError, 
        globalErrorHandler.createErrorContext('batch_processing', { 
          fileCount: filePaths.length,
          successfulFiles,
          failedFiles 
        })
      );
      
      throw processingError;
    } finally {
      this.isCurrentlyProcessing = false;
      this.shouldCancel = false;
    }
  }

  /**
   * Get current processing progress
   */
  getProgress(): ProcessingProgress {
    return { ...this.currentProgress };
  }

  /**
   * Cancel ongoing processing
   */
  cancelProcessing(): void {
    if (this.isCurrentlyProcessing) {
      this.shouldCancel = true;
    }
  }

  /**
   * Check if processing is currently active
   */
  isProcessing(): boolean {
    return this.isCurrentlyProcessing;
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(filePaths: string[]): void {
    this.currentProgress = {
      currentFile: '',
      filesProcessed: 0,
      totalFiles: filePaths.length,
      percentage: 0,
      estimatedTimeRemaining: undefined
    };
  }

  /**
   * Create initial progress state
   */
  private createInitialProgress(): ProcessingProgress {
    return {
      currentFile: '',
      filesProcessed: 0,
      totalFiles: 0,
      percentage: 0,
      estimatedTimeRemaining: undefined
    };
  }

  /**
   * Update progress tracking
   */
  private updateProgress(currentFile: string): void {
    this.currentProgress.currentFile = currentFile;
    this.currentProgress.filesProcessed++;
    this.currentProgress.percentage = Math.round(
      (this.currentProgress.filesProcessed / this.currentProgress.totalFiles) * 100
    );

    // Calculate estimated time remaining
    if (this.currentProgress.filesProcessed > 0) {
      const avgTimePerFile = Date.now() / this.currentProgress.filesProcessed;
      const remainingFiles = this.currentProgress.totalFiles - this.currentProgress.filesProcessed;
      this.currentProgress.estimatedTimeRemaining = Math.round(avgTimePerFile * remainingFiles);
    }
  }

  /**
   * Validate all files before processing (but still process invalid files to generate proper errors)
   */
  private async validateFiles(filePaths: string[]): Promise<string[]> {
    // For now, return all files so they can be processed and proper errors generated
    // The actual validation will happen during individual file processing
    return filePaths;
  }

  /**
   * Create processing batches based on concurrency limits
   */
  private createProcessingBatches(filePaths: string[]): string[][] {
    const batches: string[][] = [];
    
    for (let i = 0; i < filePaths.length; i += this.maxConcurrentFiles) {
      const batch = filePaths.slice(i, i + this.maxConcurrentFiles);
      batches.push(batch);
    }
    
    return batches;
  }

  /**
   * Process a batch of files concurrently
   */
  private async processBatch(filePaths: string[], options: ProcessingOptions): Promise<FileProcessingResult[]> {
    const processingPromises = filePaths.map(filePath => 
      this.processSingleFile(filePath, options)
    );

    // Wait for all files in batch to complete
    return Promise.all(processingPromises);
  }

  /**
   * Process a single file with error handling and recovery
   */
  private async processSingleFile(filePath: string, options: ProcessingOptions): Promise<FileProcessingResult> {
    const startTime = Date.now();
    const filename = path.basename(filePath);
    const fileOperationId = `file_${filename}_${Date.now()}`;

    performanceLogger.startTimer(fileOperationId, `Processing file: ${filename}`);
    
    logger.debug(LogCategories.BATCH_PROCESSING, 
      `Starting file processing: ${filename}`, 
      { filePath, options }
    );

    try {
      // Check if processing should be cancelled
      if (this.shouldCancel) {
        logger.info(LogCategories.BATCH_PROCESSING, `Skipping ${filename} - processing cancelled`);
        return {
          filename,
          success: false,
          error: 'Processing cancelled by user',
          processingTime: Date.now() - startTime
        };
      }

      // Create recovery context
      const recoveryContext = errorRecoveryService.createRecoveryContext(
        'single_file_processing',
        {
          filePath,
          originalOptions: options,
          maxAttempts: 3
        }
      );

      // Execute with automatic recovery
      const result = await errorRecoveryService.executeWithRecovery(
        async () => {
          // Parse document
          logger.debug(LogCategories.DOCUMENT_PARSING, `Parsing document: ${filename}`);
          const document = await this.documentParser.parseDocument(filePath);
          
          // Process content
          logger.debug(LogCategories.CONTENT_PROCESSING, `Processing content: ${filename}`);
          const structuredContent = await this.contentProcessor.cleanContent(document);
          
          return structuredContent;
        },
        recoveryContext,
        (error, recoveryResult) => {
          logger.warn(LogCategories.ERROR_HANDLING, 
            `Recovery attempted for ${filename}`, 
            { error: error.message, recoveryAction: recoveryResult.action, recoveryMessage: recoveryResult.message }
          );
        }
      );

      const processingTime = performanceLogger.endTimer(fileOperationId, `Successfully processed: ${filename}`);
      
      logger.info(LogCategories.BATCH_PROCESSING, 
        `Successfully processed: ${filename}`, 
        { processingTime: `${processingTime}ms` }
      );

      return {
        filename,
        success: true,
        output: result,
        processingTime
      };

    } catch (error) {
      const processingTime = performanceLogger.endTimer(fileOperationId, `Failed to process: ${filename}`);
      
      const errorMessage = this.getErrorMessage(error);
      
      logger.error(LogCategories.BATCH_PROCESSING, 
        `Failed to process: ${filename}`, 
        error as Error,
        { processingTime: `${processingTime}ms`, filePath }
      );

      return {
        filename,
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * Get user-friendly error message from error object
   */
  private getErrorMessage(error: any): string {
    if (error instanceof FileAccessError || 
        error instanceof ParsingError || 
        error instanceof ProcessingError || 
        error instanceof SystemError) {
      return globalErrorHandler.getUserFriendlyMessage(error);
    } else {
      return `Unexpected error: ${(error as Error).message || 'Unknown error occurred'}`;
    }
  }

  /**
   * Check memory usage and throw error if threshold exceeded
   */
  private async checkMemoryUsage(): Promise<void> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (usedMemoryMB > this.memoryThreshold) {
        throw new MemoryError(`Memory usage (${Math.round(usedMemoryMB)}MB) exceeded threshold (${this.memoryThreshold}MB)`);
      }
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    maxConcurrentFiles: number;
    memoryThreshold: number;
    isProcessing: boolean;
    currentProgress: ProcessingProgress;
  } {
    return {
      maxConcurrentFiles: this.maxConcurrentFiles,
      memoryThreshold: this.memoryThreshold,
      isProcessing: this.isCurrentlyProcessing,
      currentProgress: this.getProgress()
    };
  }

  /**
   * Update processing configuration
   */
  updateConfiguration(config: {
    maxConcurrentFiles?: number;
    memoryThreshold?: number;
  }): void {
    if (this.isCurrentlyProcessing) {
      throw new ProcessingError('Cannot update configuration while processing is active', 'configuration_update');
    }

    if (config.maxConcurrentFiles !== undefined) {
      this.maxConcurrentFiles = Math.max(1, Math.min(10, config.maxConcurrentFiles));
    }

    if (config.memoryThreshold !== undefined) {
      this.memoryThreshold = Math.max(100, config.memoryThreshold);
    }
  }
}