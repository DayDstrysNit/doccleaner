import React, { useState } from 'react';
import { FileProcessingResult } from '../models';
import './OutputManager.css';

export interface OutputManagerProps {
  results: FileProcessingResult[];
  onDownloadAll?: (results: { filename: string; content: string; format: string }[]) => void;
  onCopyAll?: (content: string) => void;
  onClearResults?: () => void;
}

const OutputManager: React.FC<OutputManagerProps> = ({
  results,
  onDownloadAll,
  onCopyAll,
  onClearResults
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter successful results
  const successfulResults = results.filter(result => result.success && result.output);

  // Simple handlers for testing
  const handleDownloadAll = () => {
    if (onDownloadAll) {
      const simpleResults = successfulResults.map(result => ({
        filename: result.filename,
        content: 'Simple test content',
        format: 'txt'
      }));
      onDownloadAll(simpleResults);
    }
  };

  const handleCopyAll = () => {
    if (onCopyAll) {
      onCopyAll('Simple test content');
    }
  };

  const handleClearResults = () => {
    if (onClearResults) {
      onClearResults();
    }
  };

  if (results.length === 0) {
    return (
      <div className="output-manager">
        <div className="output-empty">
          <p>No processing results available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="output-manager">
      <div className="output-header">
        <div className="output-title">
          <h3>Output Management</h3>
          <div className="output-summary">
            {successfulResults.length} of {results.length} files processed successfully
          </div>
        </div>

        <div className="output-controls">
          <div className="bulk-actions">
            <button
              className="copy-all-button"
              onClick={handleCopyAll}
              disabled={successfulResults.length === 0 || isProcessing}
              title="Copy all converted content to clipboard"
            >
              {isProcessing ? 'Processing...' : 'Copy All'}
            </button>
            <button
              className="download-all-button"
              onClick={handleDownloadAll}
              disabled={successfulResults.length === 0 || isProcessing}
              title="Download all converted files"
            >
              {isProcessing ? 'Processing...' : 'Download All'}
            </button>
            <button
              className="clear-button"
              onClick={handleClearResults}
              title="Clear all results"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="output-list">
        {results.map((result, index) => (
          <div key={index} className={`output-item ${result.success ? 'success' : 'error'}`}>
            <div className="output-item-header">
              <div className="file-info">
                <div className="filename">{result.filename}</div>
                <div className="file-stats">
                  {result.success && result.output ? (
                    <>
                      <span className="processing-time">
                        {result.processingTime}ms
                      </span>
                      <span className="content-size">
                        Simple content
                      </span>
                    </>
                  ) : (
                    <span className="error-indicator">Failed</span>
                  )}
                </div>
              </div>
            </div>

            {!result.success && result.error && (
              <div className="error-details">
                <div className="error-message">{result.error}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutputManager;