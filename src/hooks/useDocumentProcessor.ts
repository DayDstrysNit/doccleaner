import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BatchResult,
  ProcessingOptions,
  ProcessingProgress,
  FileProcessingResult,
  StructuredContent,
  AppSettings
} from '../models';
import {
  ConcurrentBatchProcessor,
  MammothDocumentParser,
  WordContentProcessor,
  MultiFormatConverter,
  settingsService
} from '../services';
import { FileInfo } from '../components/FileSelector';

export interface DocumentProcessorState {
  isProcessing: boolean;
  progress: ProcessingProgress;
  results: FileProcessingResult[];
  error: string | null;
  selectedResult: FileProcessingResult | null;
  settings: AppSettings | null;
}

export interface DocumentProcessorActions {
  startProcessing: (files: FileInfo[], options?: Partial<ProcessingOptions>) => Promise<void>;
  cancelProcessing: () => void;
  clearResults: () => void;
  selectResult: (result: FileProcessingResult | null) => void;
  retryFailedFiles: (options?: Partial<ProcessingOptions>) => Promise<void>;
  getDefaultProcessingOptions: () => ProcessingOptions;
}

export const useDocumentProcessor = (): [DocumentProcessorState, DocumentProcessorActions] => {
  const [state, setState] = useState<DocumentProcessorState>({
    isProcessing: false,
    progress: {
      currentFile: '',
      filesProcessed: 0,
      totalFiles: 0,
      percentage: 0
    },
    results: [],
    error: null,
    selectedResult: null,
    settings: null
  });

  // Service instances
  const batchProcessorRef = useRef<ConcurrentBatchProcessor>();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.loadSettings();
        setState(prev => ({ ...prev, settings }));
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Initialize services if not already done
  const getBatchProcessor = useCallback(() => {
    if (!batchProcessorRef.current) {
      batchProcessorRef.current = new ConcurrentBatchProcessor();
    }
    return batchProcessorRef.current;
  }, []);

  // Start progress monitoring
  const startProgressMonitoring = useCallback(() => {
    const batchProcessor = getBatchProcessor();
    
    progressIntervalRef.current = setInterval(() => {
      const isProcessing = batchProcessor.isProcessing();
      const progress = batchProcessor.getProgress();
      
      setState(prev => ({
        ...prev,
        isProcessing,
        progress
      }));

      // Stop monitoring when processing is complete
      if (!isProcessing && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, 100);
  }, [getBatchProcessor]);

  // Stop progress monitoring
  const stopProgressMonitoring = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Convert FileInfo to file paths for processing
  const prepareFilesForProcessing = useCallback(async (files: FileInfo[]): Promise<File[]> => {
    const validFiles = files.filter(f => f.isValid);
    return validFiles.map(f => f.file);
  }, []);

  // Get default processing options from settings
  const getDefaultProcessingOptions = useCallback((): ProcessingOptions => {
    const settings = state.settings;
    if (!settings) {
      return {
        outputFormat: 'plaintext',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };
    }

    return {
      outputFormat: settings.processing.defaultOutputFormat,
      preserveImages: settings.processing.preserveImages,
      includeMetadata: settings.processing.includeMetadata,
      cleanupLevel: settings.processing.cleanupLevel,
      customSettings: {
        batchSize: settings.processing.batchSize,
        maxConcurrentFiles: settings.processing.maxConcurrentFiles
      }
    };
  }, [state.settings]);

  // Start processing files
  const startProcessing = useCallback(async (files: FileInfo[], options?: Partial<ProcessingOptions>) => {
    try {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null,
        results: []
      }));

      const batchProcessor = getBatchProcessor();
      const filePaths = await prepareFilesForProcessing(files);

      if (filePaths.length === 0) {
        throw new Error('No valid files to process');
      }

      // Merge provided options with defaults from settings
      const defaultOptions = getDefaultProcessingOptions();
      const finalOptions: ProcessingOptions = { ...defaultOptions, ...options };

      // Start progress monitoring
      startProgressMonitoring();

      // Process files
      const result = await batchProcessor.processFilePaths(filePaths, finalOptions);

      // Auto-select first result based on settings
      const shouldAutoSelect = state.settings?.ui.autoSelectFirstResult ?? true;
      const selectedResult = shouldAutoSelect ? (result.results.find(r => r.success) || null) : null;

      setState(prev => ({
        ...prev,
        isProcessing: false,
        results: result.results,
        selectedResult
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage
      }));
    } finally {
      stopProgressMonitoring();
    }
  }, [getBatchProcessor, prepareFilesForProcessing, startProgressMonitoring, stopProgressMonitoring, getDefaultProcessingOptions, state.settings]);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    const batchProcessor = getBatchProcessor();
    batchProcessor.cancelProcessing();
    
    setState(prev => ({
      ...prev,
      isProcessing: false
    }));
    
    stopProgressMonitoring();
  }, [getBatchProcessor, stopProgressMonitoring]);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      selectedResult: null,
      error: null
    }));
  }, []);

  // Select result for preview
  const selectResult = useCallback((result: FileProcessingResult | null) => {
    setState(prev => ({
      ...prev,
      selectedResult: result
    }));
  }, []);

  // Retry failed files
  const retryFailedFiles = useCallback(async (options?: Partial<ProcessingOptions>) => {
    const failedResults = state.results.filter(r => !r.success);
    if (failedResults.length === 0) return;

    try {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      const batchProcessor = getBatchProcessor();
      const filePaths = failedResults.map(r => r.filename);

      // Merge provided options with defaults from settings
      const defaultOptions = getDefaultProcessingOptions();
      const finalOptions: ProcessingOptions = { ...defaultOptions, ...options };

      startProgressMonitoring();

      const result = await batchProcessor.processFilePaths(filePaths, finalOptions);

      // Merge results with existing successful ones
      setState(prev => {
        const updatedResults = [...prev.results];
        
        result.results.forEach(newResult => {
          const existingIndex = updatedResults.findIndex(r => r.filename === newResult.filename);
          if (existingIndex >= 0) {
            updatedResults[existingIndex] = newResult;
          }
        });

        return {
          ...prev,
          isProcessing: false,
          results: updatedResults,
          selectedResult: prev.selectedResult || result.results.find(r => r.success) || null
        };
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage
      }));
    } finally {
      stopProgressMonitoring();
    }
  }, [state.results, getBatchProcessor, startProgressMonitoring, stopProgressMonitoring, getDefaultProcessingOptions]);

  const actions: DocumentProcessorActions = {
    startProcessing,
    cancelProcessing,
    clearResults,
    selectResult,
    retryFailedFiles,
    getDefaultProcessingOptions
  };

  return [state, actions];
};