import React, { useState, useEffect } from 'react';
import './App.css';
import FileSelector, { FileInfo } from '../components/FileSelector';
import FileList from '../components/FileList';
import ProcessingDashboard from '../components/ProcessingDashboard';
import ProcessingStatus from '../components/ProcessingStatus';
import PreviewPanel from '../components/PreviewPanel';
import OutputManager from '../components/OutputManager';
import SettingsPanel from '../components/SettingsPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { DocumentProcessorProvider, useDocumentProcessorContext } from '../context/DocumentProcessorContext';
// import { MultiFormatConverter } from '../services/formatConverter';
import { AppSettings } from '../models/settings';

// Main App content component that uses the context
const AppContent: React.FC = () => {
  const { state, actions } = useDocumentProcessorContext();
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  
  // Debug state changes
  useEffect(() => {
    console.log('App.tsx - State changed:', {
      resultsLength: state.results.length,
      selectedResult: state.selectedResult?.filename,
      isProcessing: state.isProcessing,
      error: state.error
    });
  }, [state.results, state.selectedResult, state.isProcessing, state.error]);
  const [showResultsDetails, setShowResultsDetails] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'html' | 'markdown' | 'plaintext'>('plaintext');
  // const [formatConverter] = useState(() => new MultiFormatConverter());
  const [showSettings, setShowSettings] = useState(false);

  const handleFilesSelected = (files: FileInfo[]) => {
    setSelectedFiles(prevFiles => [...prevFiles, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    actions.clearResults();
  };

  const handleProcessingComplete = () => {
    // Auto-selection is now handled by the hook based on settings
    console.log('Processing completed:', state.results);
    console.log('App.tsx - Current state:', {
      resultsLength: state.results.length,
      selectedResult: state.selectedResult?.filename,
      isProcessing: state.isProcessing,
      error: state.error
    });
  };

  const handleProcessingCancelled = () => {
    console.log('Processing cancelled by user');
  };

  const handleProcessingError = (error: string) => {
    console.error('Processing error:', error);
  };

  const toggleResultsDetails = () => {
    setShowResultsDetails(prev => !prev);
  };

  // Preview panel handlers
  const handleFormatChange = (format: 'html' | 'markdown' | 'plaintext') => {
    setOutputFormat(format);
  };

  const handleCopyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log('Content copied to clipboard');
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  };

  const handleDownloadContent = (content: string, format: string) => {
    const filename = state.selectedResult?.filename || 'converted-document';
    const extension = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'txt';
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/\.[^/.]+$/, '')}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Output manager handlers
  const handleDownloadAll = (results: { filename: string; content: string; format: string }[]) => {
    results.forEach(result => {
      const blob = new Blob([result.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.filename.replace(/\.[^/.]+$/, '')}.${result.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  const handleCopyAll = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log('All content copied to clipboard');
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy all content:', error);
    }
  };

  const handleClearResults = () => {
    // Check if confirmation is required based on settings
    const shouldConfirm = state.settings?.ui.confirmBeforeClearing ?? true;
    
    if (shouldConfirm && typeof window !== 'undefined' && window.confirm && !window.confirm('Are you sure you want to clear all results?')) {
      return;
    }
    
    if (actions && typeof actions.clearResults === 'function') {
      actions.clearResults();
    }
  };

  const handleSettingsChange = (settings: AppSettings) => {
    // Update output format if it changed
    if (settings.processing.defaultOutputFormat !== outputFormat) {
      setOutputFormat(settings.processing.defaultOutputFormat);
    }
    
    // Update results details visibility based on settings
    if (settings.ui.showProcessingDetails !== showResultsDetails) {
      setShowResultsDetails(settings.ui.showProcessingDetails);
    }
  };

  // Helper function to convert nested lists to proper HTML
  const convertListToHtml = (listContent: string, isOrdered: boolean) => {
    const lines = listContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '';
    
    const result: string[] = [];
    const stack: { level: number; tag: string; isOrdered: boolean }[] = [];
    
    for (const line of lines) {
      // Calculate indentation level (each 2 spaces = 1 level)
      const indentMatch = line.match(/^(\s*)/);
      const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      
      // Determine if this specific line is ordered or unordered
      const hasOrderedMarker = /^\s*#NUM#\s/.test(line);
      const hasNumbering = /^\s*\d+[\.\)]\s/.test(line) || 
                          /^\s*[a-zA-Z][\.\)]\s/.test(line) ||
                          /^\s*[ivxlcdm]+[\.\)]\s/i.test(line);
      const lineIsOrdered = hasOrderedMarker || hasNumbering;
      
      // Extract the content without bullets/numbers/special markers
      const content = line.replace(/^[\s]*([•◦▪\d\w\(\)\.]+|#NUM#)\s*/, '').trim();
      
      if (!content) continue;
      
      // Close lists if we've decreased in level
      while (stack.length > 0 && stack[stack.length - 1].level > indentLevel) {
        const closed = stack.pop()!;
        result.push(`</${closed.tag}>`);
      }
      
      // Check if we need to close and reopen at the same level due to list type change
      if (stack.length > 0 && 
          stack[stack.length - 1].level === indentLevel && 
          stack[stack.length - 1].isOrdered !== lineIsOrdered) {
        const closed = stack.pop()!;
        result.push(`</${closed.tag}>`);
      }
      
      // Open new list if needed
      if (stack.length === 0 || 
          stack[stack.length - 1].level < indentLevel ||
          (stack.length > 0 && stack[stack.length - 1].level === indentLevel && 
           stack[stack.length - 1].isOrdered !== lineIsOrdered)) {
        const listTag = lineIsOrdered ? 'ol' : 'ul';
        result.push(`<${listTag}>`);
        stack.push({ level: indentLevel, tag: listTag, isOrdered: lineIsOrdered });
      }
      
      // Add the list item
      result.push(`<li>${content}</li>`);
    }
    
    // Close any remaining open lists
    while (stack.length > 0) {
      const closed = stack.pop()!;
      result.push(`</${closed.tag}>`);
    }
    
    return result.join('\n');
  };

  // Helper functions for format conversion
  const convertToHtml = (title: string, sections: any[]) => {
    const htmlSections = sections.map(section => {
      switch (section.type) {
        case 'heading':
          const level = section.level || 2;
          return `<h${level}>${section.content}</h${level}>`;
        
        case 'list':
          return convertListToHtml(section.content, section.listType);
        
        case 'table':
          const rows = section.content.split('\n').map((row: string) => {
            const cells = row.split(' | ').map((cell: string) => `<td>${cell.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
          }).join('\n');
          return `<table>\n${rows}\n</table>`;
        
        case 'paragraph':
        default:
          // Convert newlines to <br> tags for paragraphs
          const paragraphContent = section.content.replace(/\n/g, '<br>');
          return `<p>${paragraphContent}</p>`;
      }
    }).join('\n');
    
    return `<h1>${title}</h1>\n${htmlSections}`;
  };

  const convertToMarkdown = (title: string, sections: any[]) => {
    const markdownSections = sections.map(section => {
      switch (section.type) {
        case 'heading':
          const level = section.level || 2;
          const hashes = '#'.repeat(level);
          return `${hashes} ${section.content}`;
        
        case 'list':
          // For markdown, preserve indentation and convert bullets/numbers
          const items = section.content.split('\n').filter(item => item.trim());
          let orderCounter = 1;
          
          return items.map((item: string) => {
            if (!item.trim()) return '';
            
            // Calculate indentation level
            const indentMatch = item.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            if (section.listType === 'ordered') {
              // Generate proper sequential numbering while preserving indentation
              const content = item.replace(/^(\s*)[\d\w\(\)\.#NUM#]+\s*/, '').trim();
              return `${indent}${orderCounter++}. ${content}`;
            } else {
              // Convert various bullets to simple - while preserving indentation
              const content = item.replace(/^(\s*)[•◦▪\-\*\+]+\s*/, '').trim();
              return `${indent}- ${content}`;
            }
          }).join('\n');
        
        case 'table':
          const rows = section.content.split('\n');
          if (rows.length === 0) return '';
          
          // Create markdown table
          const headerRow = `| ${rows[0].split(' | ').join(' | ')} |`;
          const separatorRow = `| ${rows[0].split(' | ').map(() => '---').join(' | ')} |`;
          const dataRows = rows.slice(1).map(row => `| ${row.split(' | ').join(' | ')} |`);
          
          return [headerRow, separatorRow, ...dataRows].join('\n');
        
        case 'paragraph':
        default:
          return section.content;
      }
    }).join('\n\n');
    
    return `# ${title}\n\n${markdownSections}`;
  };

  const convertToPlainText = (title: string, sections: any[]) => {
    const textSections = sections.map(section => section.content).join('\n\n');
    return `${title}\n\n${textSections}`;
  };

  // Get converted content in the selected format
  const getConvertedContent = () => {
    if (!state.selectedResult?.output) return '';
    
    try {
      const content = state.selectedResult.output;
      const title = content.title || 'Document';
      const sections = content.sections || [];
      
      switch (outputFormat) {
        case 'html':
          return convertToHtml(title, sections);
        case 'markdown':
          return convertToMarkdown(title, sections);
        case 'plaintext':
        default:
          return convertToPlainText(title, sections);
      }
    } catch (error) {
      console.error('Failed to convert content:', error);
      return 'Error converting content';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-text">
            <h1>DOCX Web Converter</h1>
            <p>Convert Microsoft Word documents to clean, web-ready text</p>
          </div>
          <button 
            className="settings-button"
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>
      <main>
        <div className="converter-container">
          <FileSelector 
            onFilesSelected={handleFilesSelected}
            multiple={true}
            maxFileSize={state.settings?.files.maxFileSize || 50 * 1024 * 1024}
          />
          
          <FileList
            files={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
            showPreview={state.settings?.ui.showPreviewByDefault ?? true}
          />

          <ProcessingDashboard
            files={selectedFiles}
            onProcessingComplete={handleProcessingComplete}
            onProcessingCancelled={handleProcessingCancelled}
            onError={handleProcessingError}
          />

          {state.results.length > 0 && (
            <ProcessingStatus
              results={state.results}
              showDetails={state.settings?.ui.showProcessingDetails ?? showResultsDetails}
              onToggleDetails={toggleResultsDetails}
            />
          )}

          {state.selectedResult && state.selectedResult.output && (
            <PreviewPanel
              convertedContent={getConvertedContent()}
              outputFormat={outputFormat}
              showComparison={false}
              onFormatChange={handleFormatChange}
              onCopyContent={handleCopyContent}
              onDownloadContent={handleDownloadContent}
            />
          )}

          {state.results && state.results.length > 0 && (
            <OutputManager
              results={state.results}
              onDownloadAll={handleDownloadAll}
              onCopyAll={handleCopyAll}
              onClearResults={handleClearResults}
            />
          )}
        </div>
      </main>

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
};

// Main App component with context provider and error boundary
function App() {
  return (
    <ErrorBoundary>
      <DocumentProcessorProvider>
        <AppContent />
      </DocumentProcessorProvider>
    </ErrorBoundary>
  );
}

export default App;
