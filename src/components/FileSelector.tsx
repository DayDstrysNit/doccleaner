import React, { useState, useCallback, useRef } from 'react';
import './FileSelector.css';

export interface FileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  isValid: boolean;
  validationError?: string;
}

interface FileSelectorProps {
  onFilesSelected: (files: FileInfo[]) => void;
  acceptedFormats?: string[];
  maxFileSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
}

const SUPPORTED_FORMATS = ['.docx', '.doc'];
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFilesSelected,
  acceptedFormats = SUPPORTED_FORMATS,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  multiple = true,
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): { isValid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxFileSize) {
      return {
        isValid: false,
        error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(maxFileSize / 1024 / 1024).toFixed(1)}MB)`
      };
    }

    // Check file extension
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.some(format => format.toLowerCase() === fileExtension)) {
      return {
        isValid: false,
        error: `File format "${fileExtension}" is not supported. Supported formats: ${acceptedFormats.join(', ')}`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File is empty'
      };
    }

    return { isValid: true };
  }, [acceptedFormats, maxFileSize]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    
    const fileArray = Array.from(files);
    const processedFiles: FileInfo[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      
      const fileInfo: FileInfo = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
        isValid: validation.isValid,
        validationError: validation.error
      };

      processedFiles.push(fileInfo);
    }

    setIsProcessing(false);
    onFilesSelected(processedFiles);
  }, [validateFile, onFilesSelected]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleBrowseClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const getDropZoneClassName = () => {
    let className = 'file-selector-dropzone';
    if (isDragOver) className += ' drag-over';
    if (disabled) className += ' disabled';
    if (isProcessing) className += ' processing';
    return className;
  };

  return (
    <div className="file-selector">
      <div
        className={getDropZoneClassName()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="File drop zone - click to browse or drag files here"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          multiple={multiple}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        
        <div className="file-selector-content">
          {isProcessing ? (
            <div className="processing-indicator">
              <div className="spinner" />
              <p>Processing files...</p>
            </div>
          ) : (
            <>
              <div className="file-selector-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
              </div>
              
              <div className="file-selector-text">
                <h3>
                  {isDragOver ? 'Drop files here' : 'Select DOCX files'}
                </h3>
                <p>
                  Drag and drop your Word documents here, or{' '}
                  <span className="browse-link">click to browse</span>
                </p>
                <div className="file-selector-info">
                  <p>Supported formats: {acceptedFormats.join(', ')}</p>
                  <p>Maximum file size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileSelector;