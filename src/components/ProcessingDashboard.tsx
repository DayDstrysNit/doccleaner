import React, { useState, useCallback } from 'react';
import { ProcessingOptions, ProcessingProgress, FileProcessingResult } from '../models';
import { useDocumentProcessorContext } from '../context/DocumentProcessorContext';
import { FileInfo } from './FileSelector';
import './ProcessingDashboard.css';

export interface ProcessingDashboardProps {
  files: FileInfo[];
  onProcessingComplete?: () => void;
  onProcessingCancelled?: () => void;
  onError?: (error: string) => void;
}

const ProcessingDashboard: React.FC<ProcessingDashboardProps> = ({
  files,
  onProcessingComplete,
  onProcessingCancelled,
  onError
}) => {
  const { state, actions } = useDocumentProcessorContext();
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    outputFormat: 'plaintext',
    preserveImages: false,
    includeMetadata: false,
    cleanupLevel: 'standard',
    customSettings: {}
  });

  // Handle start processing
  const handleStartProcessing = useCallback(async () => {
    const validFiles = files.filter(f => f.isValid).map(f => f.file);
    
    if (validFiles.length === 0) {
      onError?.('No valid files selected for processing');
      return;
    }

    try {
      await actions.startProcessing(validFiles, processingOptions);
      onProcessingComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      onError?.(errorMessage);
    }
  }, [files, processingOptions, actions, onProcessingComplete, onError]);

  // Handle cancel processing
  const handleCancelProcessing = useCallback(() => {
    actions.cancelProcessing();
    onProcessingCancelled?.();
  }, [actions, onProcessingCancelled]);

  // Handle retry failed files
  const handleRetryFailed = useCallback(async () => {
    try {
      await actions.retryFailedFiles(processingOptions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      onError?.(errorMessage);
    }
  }, [actions, processingOptions, onError]);

  // Handle processing options change
  const handleOptionsChange = useCallback((newOptions: Partial<ProcessingOptions>) => {
    setProcessingOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // Format time remaining
  const formatTimeRemaining = (milliseconds?: number): string => {
    if (!milliseconds) return 'Calculating...';
    
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s remaining`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  // Format file name for display
  const formatFileName = (fileName: string): string => {
    if (fileName.length <= 30) return fileName;
    return `${fileName.substring(0, 15)}...${fileName.substring(fileName.length - 12)}`;
  };

  const validFiles = files.filter(f => f.isValid);
  const hasValidFiles = validFiles.length > 0;
  const hasFailedResults = state.results.some(r => !r.success);

  return (
    <div className="processing-dashboard">
      {/* Processing Options */}
      {!state.isProcessing && hasValidFiles && (
        <div className="processing-options">
          <div className="options-header">
            <h3>Processing Options</h3>
          </div>
          
          <div className="options-grid">
            <div className="option-group">
              <label htmlFor="output-format">Output Format:</label>
              <select
                id="output-format"
                value={processingOptions.outputFormat}
                onChange={(e) => handleOptionsChange({ 
                  outputFormat: e.target.value as 'html' | 'markdown' | 'plaintext' 
                })}
              >
                <option value="plaintext">Plain Text</option>
                <option value="html">HTML</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>

            <div className="option-group">
              <label htmlFor="cleanup-level">Cleanup Level:</label>
              <select
                id="cleanup-level"
                value={processingOptions.cleanupLevel}
                onChange={(e) => handleOptionsChange({ 
                  cleanupLevel: e.target.value as 'minimal' | 'standard' | 'aggressive' 
                })}
              >
                <option value="minimal">Minimal</option>
                <option value="standard">Standard</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div className="option-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={processingOptions.preserveImages}
                  onChange={(e) => handleOptionsChange({ preserveImages: e.target.checked })}
                />
                Preserve Images
              </label>
            </div>

            <div className="option-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={processingOptions.includeMetadata}
                  onChange={(e) => handleOptionsChange({ includeMetadata: e.target.checked })}
                />
                Include Metadata
              </label>
            </div>
          </div>

          <div className="processing-controls">
            <button
              className="start-processing-button"
              onClick={handleStartProcessing}
              disabled={!hasValidFiles}
            >
              Process {validFiles.length} File{validFiles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Active Processing */}
      {state.isProcessing && (
        <div className="processing-active">
          <div className="processing-header">
            <h3>Processing Documents</h3>
            <button 
              className="cancel-button"
              onClick={handleCancelProcessing}
              aria-label="Cancel processing"
            >
              Cancel
            </button>
          </div>

          <div className="progress-section">
            <div className="progress-bar-container">
              <div 
                className="progress-bar"
                style={{ width: `${state.progress.percentage}%` }}
                role="progressbar"
                aria-valuenow={state.progress.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Processing progress: ${state.progress.percentage}%`}
              />
            </div>
            
            <div className="progress-info">
              <span className="progress-percentage">
                {state.progress.percentage}%
              </span>
              <span className="progress-files">
                {state.progress.filesProcessed} of {state.progress.totalFiles} files
              </span>
            </div>
          </div>

          <div className="current-file-section">
            <div className="current-file-label">Currently processing:</div>
            <div className="current-file-name">
              {state.progress.currentFile ? 
                formatFileName(state.progress.currentFile) : 
                'Preparing...'
              }
            </div>
          </div>

          <div className="time-remaining">
            {formatTimeRemaining(state.progress.estimatedTimeRemaining)}
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="processing-error">
          <div className="error-header">
            <h3>Processing Error</h3>
          </div>
          <div className="error-message">
            {state.error}
          </div>
          <div className="error-actions">
            <button
              className="retry-button"
              onClick={handleStartProcessing}
              disabled={!hasValidFiles}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Processing Complete */}
      {!state.isProcessing && state.results.length > 0 && (
        <div className="processing-complete">
          <div className="results-header">
            <h3>Processing Complete</h3>
          </div>
          <div className="results-summary">
            <div className="summary-item">
              <span className="summary-label">Total Files:</span>
              <span className="summary-value">{state.results.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Successful:</span>
              <span className="summary-value success">
                {state.results.filter(r => r.success).length}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Failed:</span>
              <span className="summary-value error">
                {state.results.filter(r => !r.success).length}
              </span>
            </div>
          </div>
          
          {hasFailedResults && (
            <div className="retry-section">
              <button
                className="retry-failed-button"
                onClick={handleRetryFailed}
              >
                Retry Failed Files
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export processing state interface for external use
export interface ProcessingState {
  isProcessing: boolean;
  progress: ProcessingProgress;
  results: FileProcessingResult[];
  error?: string;
}

export default ProcessingDashboard;