import React from 'react';
import { FileProcessingResult } from '../models';
import './ProcessingStatus.css';

export interface ProcessingStatusProps {
  results: FileProcessingResult[];
  showDetails?: boolean;
  onToggleDetails?: () => void;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  results,
  showDetails = false,
  onToggleDetails
}) => {
  // Calculate summary statistics
  const totalFiles = results.length;
  const successfulFiles = results.filter(r => r.success).length;
  const failedFiles = results.filter(r => !r.success).length;
  const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
  const averageProcessingTime = totalFiles > 0 ? totalProcessingTime / totalFiles : 0;

  // Format processing time
  const formatProcessingTime = (milliseconds: number): string => {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    const seconds = (milliseconds / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Get status icon
  const getStatusIcon = (success: boolean): string => {
    return success ? '✓' : '✗';
  };

  // Get status class
  const getStatusClass = (success: boolean): string => {
    return success ? 'status-success' : 'status-error';
  };

  if (totalFiles === 0) {
    return null;
  }

  return (
    <div className="processing-status">
      <div className="status-header">
        <h3>Processing Results</h3>
        {onToggleDetails && (
          <button 
            className="toggle-details-button"
            onClick={onToggleDetails}
            aria-expanded={showDetails}
            aria-label={showDetails ? 'Hide details' : 'Show details'}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        )}
      </div>

      <div className="status-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Files:</span>
            <span className="stat-value">{totalFiles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Successful:</span>
            <span className="stat-value success">{successfulFiles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Failed:</span>
            <span className="stat-value error">{failedFiles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg. Time:</span>
            <span className="stat-value">{formatProcessingTime(averageProcessingTime)}</span>
          </div>
        </div>

        {failedFiles > 0 && (
          <div className="error-summary">
            <span className="error-indicator">⚠️</span>
            <span className="error-text">
              {failedFiles} file{failedFiles !== 1 ? 's' : ''} failed to process
            </span>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="status-details">
          <div className="details-header">
            <h4>File Processing Details</h4>
          </div>
          
          <div className="file-results">
            {results.map((result, index) => (
              <div 
                key={`${result.filename}-${index}`}
                className={`file-result ${getStatusClass(result.success)}`}
              >
                <div className="file-result-header">
                  <span className={`status-icon ${getStatusClass(result.success)}`}>
                    {getStatusIcon(result.success)}
                  </span>
                  <span className="file-name" title={result.filename}>
                    {result.filename}
                  </span>
                  <span className="processing-time">
                    {formatProcessingTime(result.processingTime)}
                  </span>
                </div>
                
                {!result.success && result.error && (
                  <div className="error-details">
                    <span className="error-label">Error:</span>
                    <span className="error-message">{result.error}</span>
                  </div>
                )}
                
                {result.success && result.output && (
                  <div className="success-details">
                    <span className="success-label">Sections:</span>
                    <span className="success-value">
                      {result.output.sections.length} section{result.output.sections.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;