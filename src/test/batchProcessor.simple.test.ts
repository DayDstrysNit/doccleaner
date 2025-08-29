import { describe, it, expect, beforeEach } from 'vitest';
import { ConcurrentBatchProcessor } from '../services/batchProcessor';
import { ProcessingOptions } from '../models';

describe('ConcurrentBatchProcessor - Basic Functionality', () => {
  let batchProcessor: ConcurrentBatchProcessor;

  const mockProcessingOptions: ProcessingOptions = {
    outputFormat: 'html',
    preserveImages: false,
    includeMetadata: true,
    cleanupLevel: 'standard',
    customSettings: {}
  };

  beforeEach(() => {
    batchProcessor = new ConcurrentBatchProcessor(2, 100);
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      expect(batchProcessor.isProcessing()).toBe(false);
      
      const progress = batchProcessor.getProgress();
      expect(progress.filesProcessed).toBe(0);
      expect(progress.totalFiles).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should provide processing statistics', () => {
      const stats = batchProcessor.getProcessingStats();
      
      expect(stats.maxConcurrentFiles).toBe(2);
      expect(stats.memoryThreshold).toBe(100);
      expect(stats.isProcessing).toBe(false);
      expect(stats.currentProgress).toBeDefined();
    });
  });

  describe('configuration management', () => {
    it('should allow configuration updates when not processing', () => {
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

  describe('progress tracking', () => {
    it('should return progress object with correct structure', () => {
      const progress = batchProcessor.getProgress();
      
      expect(progress).toHaveProperty('currentFile');
      expect(progress).toHaveProperty('filesProcessed');
      expect(progress).toHaveProperty('totalFiles');
      expect(progress).toHaveProperty('percentage');
      expect(progress).toHaveProperty('estimatedTimeRemaining');
      
      expect(typeof progress.currentFile).toBe('string');
      expect(typeof progress.filesProcessed).toBe('number');
      expect(typeof progress.totalFiles).toBe('number');
      expect(typeof progress.percentage).toBe('number');
    });
  });

  describe('cancellation', () => {
    it('should allow cancellation when not processing', () => {
      expect(() => {
        batchProcessor.cancelProcessing();
      }).not.toThrow();
    });
  });

  describe('error handling for invalid inputs', () => {
    it('should handle empty file arrays', async () => {
      const result = await batchProcessor.processFilePaths([], mockProcessingOptions);
      
      expect(result.totalFiles).toBe(0);
      expect(result.successfulFiles).toBe(0);
      expect(result.failedFiles).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFiles = ['nonexistent1.docx', 'nonexistent2.docx'];
      
      // This should not throw an error, but handle the files gracefully
      const result = await batchProcessor.processFilePaths(nonExistentFiles, mockProcessingOptions);
      
      expect(result.totalFiles).toBe(2);
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
      // Files should be filtered out during validation or result in failed processing
      expect(result.successfulFiles + result.failedFiles).toBeLessThanOrEqual(2);
    });
  });
});