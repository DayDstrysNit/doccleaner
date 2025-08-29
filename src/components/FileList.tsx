import React, { useState } from 'react';
import { FileInfo } from './FileSelector';
import './FileList.css';

interface FileListProps {
  files: FileInfo[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  showPreview?: boolean;
}

interface FilePreviewProps {
  file: FileInfo;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <h3>File Preview</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close preview"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="file-preview-content">
          <div className="file-details">
            <div className="detail-row">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{file.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Size:</span>
              <span className="detail-value">{formatFileSize(file.size)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{file.type || 'Unknown'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Modified:</span>
              <span className="detail-value">{file.lastModified.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className={`detail-value status ${file.isValid ? 'valid' : 'invalid'}`}>
                {file.isValid ? 'Valid' : 'Invalid'}
              </span>
            </div>
            {!file.isValid && file.validationError && (
              <div className="detail-row">
                <span className="detail-label">Error:</span>
                <span className="detail-value error">{file.validationError}</span>
              </div>
            )}
          </div>
          
          <div className="file-icon-large">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemoveFile,
  onClearAll,
  showPreview = true
}) => {
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);

  if (files.length === 0) {
    return null;
  }

  const validFiles = files.filter(f => f.isValid);
  const invalidFiles = files.filter(f => !f.isValid);

  const handlePreviewClick = (file: FileInfo) => {
    if (showPreview) {
      setPreviewFile(file);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  return (
    <>
      <div className="file-list">
        <div className="file-list-header">
          <h3>Selected Files ({files.length})</h3>
          <div className="file-list-actions">
            <button 
              className="clear-all-button"
              onClick={onClearAll}
              aria-label="Clear all files"
            >
              Clear All
            </button>
          </div>
        </div>

        {validFiles.length > 0 && (
          <div className="file-section">
            <h4 className="section-title valid">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
              Valid Files ({validFiles.length})
            </h4>
            <div className="file-items">
              {validFiles.map((file, index) => {
                const originalIndex = files.indexOf(file);
                return (
                  <div key={`valid-${originalIndex}`} className="file-item valid">
                    <div className="file-info" onClick={() => handlePreviewClick(file)}>
                      <div className="file-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14,2 14,8 20,8" />
                        </svg>
                      </div>
                      <div className="file-details">
                        <div className="file-name" title={file.name}>{file.name}</div>
                        <div className="file-meta">
                          {formatFileSize(file.size)} • {file.lastModified.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      className="remove-button"
                      onClick={() => onRemoveFile(originalIndex)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {invalidFiles.length > 0 && (
          <div className="file-section">
            <h4 className="section-title invalid">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Invalid Files ({invalidFiles.length})
            </h4>
            <div className="file-items">
              {invalidFiles.map((file, index) => {
                const originalIndex = files.indexOf(file);
                return (
                  <div key={`invalid-${originalIndex}`} className="file-item invalid">
                    <div className="file-info" onClick={() => handlePreviewClick(file)}>
                      <div className="file-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14,2 14,8 20,8" />
                        </svg>
                      </div>
                      <div className="file-details">
                        <div className="file-name" title={file.name}>{file.name}</div>
                        <div className="file-meta">
                          {formatFileSize(file.size)} • {file.lastModified.toLocaleDateString()}
                        </div>
                        {file.validationError && (
                          <div className="file-error" title={file.validationError}>
                            {file.validationError}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className="remove-button"
                      onClick={() => onRemoveFile(originalIndex)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreview file={previewFile} onClose={closePreview} />
      )}
    </>
  );
};

export default FileList;