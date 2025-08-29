import React, { useState, useMemo } from 'react';
import { StructuredContent, ProcessingOptions } from '../models';
import { MultiFormatConverter } from '../services';
import './PreviewPanel.css';

export interface PreviewPanelProps {
  originalContent?: string;
  convertedContent: string;
  outputFormat: 'html' | 'markdown' | 'plaintext';
  showComparison?: boolean;
  onFormatChange?: (format: 'html' | 'markdown' | 'plaintext') => void;
  onCopyContent?: (content: string) => void;
  onDownloadContent?: (content: string, format: string) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  originalContent,
  convertedContent,
  outputFormat,
  showComparison = false,
  onFormatChange,
  onCopyContent,
  onDownloadContent
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'comparison'>('preview');

  // Use the converted content directly (already formatted)
  const formattedContent = convertedContent;

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (formattedContent) {
      try {
        await navigator.clipboard.writeText(formattedContent);
        onCopyContent?.(formattedContent);
      } catch (error) {
        console.error('Failed to copy content:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = formattedContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        onCopyContent?.(formattedContent);
      }
    }
  };

  // Handle download
  const handleDownload = () => {
    if (formattedContent) {
      onDownloadContent?.(formattedContent, outputFormat);
    }
  };

  // Format content for display based on output format
  const getDisplayContent = (content: string) => {
    if (outputFormat === 'html') {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }
    return <pre>{content}</pre>;
  };

  // Truncate content for comparison view
  const truncateContent = (content: string, maxLength: number = 500) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (!convertedContent) {
    return (
      <div className="preview-panel">
        <div className="preview-empty">
          <p>No content to preview. Process a document to see the results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <div className="preview-tabs">
          <button
            className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          {showComparison && originalContent && (
            <button
              className={`tab-button ${activeTab === 'comparison' ? 'active' : ''}`}
              onClick={() => setActiveTab('comparison')}
            >
              Before/After
            </button>
          )}
        </div>

        <div className="preview-controls">
          <div className="format-selector">
            <label htmlFor="output-format">Format:</label>
            <select
              id="output-format"
              value={outputFormat}
              onChange={(e) => onFormatChange?.(e.target.value as 'html' | 'markdown' | 'plaintext')}
            >
              <option value="plaintext">Plain Text</option>
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>

          <div className="action-buttons">
            <button
              className="copy-button"
              onClick={handleCopy}
              disabled={!formattedContent}
              title="Copy to clipboard"
            >
              Copy
            </button>
            <button
              className="download-button"
              onClick={handleDownload}
              disabled={!formattedContent}
              title="Download file"
            >
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="preview-content">
        {activeTab === 'preview' && (
          <div className="preview-single">
            <div className="content-header">
              <h3>Converted Content ({outputFormat.toUpperCase()})</h3>
              <div className="content-stats">
                {formattedContent.length} characters
              </div>
            </div>
            <div className="content-display">
              {getDisplayContent(formattedContent)}
            </div>
          </div>
        )}

        {activeTab === 'comparison' && originalContent && (
          <div className="preview-comparison">
            <div className="comparison-pane">
              <div className="content-header">
                <h3>Original Content</h3>
                <div className="content-stats">
                  {originalContent.length} characters
                </div>
              </div>
              <div className="content-display original">
                <pre>{truncateContent(originalContent)}</pre>
              </div>
            </div>

            <div className="comparison-divider" />

            <div className="comparison-pane">
              <div className="content-header">
                <h3>Converted Content</h3>
                <div className="content-stats">
                  {formattedContent.length} characters
                </div>
              </div>
              <div className="content-display converted">
                {getDisplayContent(truncateContent(formattedContent))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;