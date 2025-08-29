import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { BrowserDocumentProcessor } from '../services/browserDocumentProcessor';
import { FileProcessingResult } from '../models';

interface DocumentProcessorState {
  isProcessing: boolean;
  progress: { currentFile: string; filesProcessed: number; totalFiles: number; percentage: number };
  results: FileProcessingResult[];
  error: string | null;
  selectedResult: FileProcessingResult | null;
  settings: any | null;
}

interface DocumentProcessorActions {
  startProcessing: (files: File[], options?: any) => Promise<void>;
  cancelProcessing: () => void;
  clearResults: () => void;
  selectResult: (result: FileProcessingResult | null) => void;
  retryFailedFiles: (options?: any) => Promise<void>;
  getDefaultProcessingOptions: () => any;
}

const useDocumentProcessor = (): [DocumentProcessorState, DocumentProcessorActions] => {
  const [state, setState] = useState<DocumentProcessorState>({
    isProcessing: false,
    progress: { currentFile: '', filesProcessed: 0, totalFiles: 0, percentage: 0 },
    results: [],
    error: null,
    selectedResult: null,
    settings: null
  });

  const [processor] = useState(() => new BrowserDocumentProcessor());
  const [processingCancelled, setProcessingCancelled] = useState(false);

  const actions: DocumentProcessorActions = {
    startProcessing: useCallback(async (files: File[]) => {
      console.log('Starting processing of', files.length, 'files');
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      setProcessingCancelled(false);
      
      try {
        const results: FileProcessingResult[] = [];
        
        for (let i = 0; i < files.length; i++) {
          if (processingCancelled) break;
          
          const file = files[i];
          setState(prev => ({
            ...prev,
            progress: {
              currentFile: file.name,
              filesProcessed: i,
              totalFiles: files.length,
              percentage: Math.round((i / files.length) * 100)
            }
          }));
          
          const result = await processor.processFile(file);
          results.push(result);
        }
        
        console.log('DocumentProcessorContext - Setting final results:', {
          resultsCount: results.length,
          results: results.map(r => ({
            filename: r.filename,
            success: r.success,
            hasOutput: !!r.output,
            sectionsCount: r.output?.sections?.length || 0
          }))
        });
        
        setState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          results,
          selectedResult: results[0] || null,
          progress: {
            currentFile: '',
            filesProcessed: results.length,
            totalFiles: files.length,
            percentage: 100
          }
        }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: error instanceof Error ? error.message : 'Processing failed'
        }));
      }
    }, [processor, processingCancelled]),
    
    cancelProcessing: useCallback(() => {
      console.log('Cancelling processing');
      setProcessingCancelled(true);
      setState(prev => ({ ...prev, isProcessing: false }));
    }, []),
    
    clearResults: useCallback(() => {
      console.log('Clearing results');
      setState(prev => ({ ...prev, results: [], selectedResult: null, error: null }));
    }, []),
    
    selectResult: useCallback((result: FileProcessingResult | null) => {
      console.log('Selecting result:', result?.filename);
      setState(prev => ({ ...prev, selectedResult: result }));
    }, []),
    
    retryFailedFiles: useCallback(async () => {
      console.log('Retrying failed files');
      const failedResults = state.results.filter(r => !r.success);
      if (failedResults.length === 0) return;
      
      // For retry, we'd need the original files, which we don't have here
      // This would need to be implemented with file caching
      console.warn('Retry functionality requires file caching implementation');
    }, [state.results]),
    
    getDefaultProcessingOptions: useCallback(() => ({
      outputFormat: 'plaintext',
      preserveImages: false,
      includeMetadata: false,
      cleanupLevel: 'standard'
    }), [])
  };

  return [state, actions];
};

interface DocumentProcessorContextType {
  state: DocumentProcessorState;
  actions: DocumentProcessorActions;
}

const DocumentProcessorContext = createContext<DocumentProcessorContextType | undefined>(undefined);

export const useDocumentProcessorContext = (): DocumentProcessorContextType => {
  const context = useContext(DocumentProcessorContext);
  if (!context) {
    throw new Error('useDocumentProcessorContext must be used within a DocumentProcessorProvider');
  }
  return context;
};

interface DocumentProcessorProviderProps {
  children: ReactNode;
}

export const DocumentProcessorProvider: React.FC<DocumentProcessorProviderProps> = ({ children }) => {
  const [state, actions] = useDocumentProcessor();

  const value: DocumentProcessorContextType = {
    state,
    actions
  };

  return (
    <DocumentProcessorContext.Provider value={value}>
      {children}
    </DocumentProcessorContext.Provider>
  );
};