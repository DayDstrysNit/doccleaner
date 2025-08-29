// Core data models and interfaces

// Document metadata interface
export interface DocumentMetadata {
  filename: string;
  fileSize: number;
  createdDate: Date;
  modifiedDate: Date;
}

// Content element types
export type ContentElementType = 'heading' | 'paragraph' | 'list' | 'table' | 'image';

// Base content element interface
export interface ContentElement {
  type: ContentElementType;
  content: string;
  level?: number; // For headings (1-6) or list nesting
  children?: ContentElement[];
  attributes?: Record<string, any>;
}

// Style definition interface
export interface StyleDefinition {
  name: string;
  type: 'paragraph' | 'character' | 'table';
  properties: Record<string, any>;
}

// Image element interface
export interface ImageElement {
  id: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  format: string;
}

// Main document model interface
export interface DocumentModel {
  metadata: DocumentMetadata;
  content: ContentElement[];
  styles: StyleDefinition[];
  images: ImageElement[];
}

// Processing metadata interface
export interface ProcessingMetadata {
  originalFilename: string;
  processedAt: string;
  wordCount: number;
  characterCount: number;
  processingTime?: number; // in milliseconds
  originalFormat?: string;
  warnings?: string[];
  errors?: string[];
}

// Content section interface for structured content
export interface ContentSection {
  type: ContentElementType;
  level?: number;
  content: string;
  listType?: 'ordered' | 'unordered';
  children?: ContentSection[];
  metadata?: Record<string, any>;
}

// Structured content interface (cleaned and processed)
export interface StructuredContent {
  title?: string;
  sections: ContentSection[];
  metadata: ProcessingMetadata;
}

// Processing options interface
export interface ProcessingOptions {
  outputFormat: 'html' | 'markdown' | 'plaintext';
  preserveImages: boolean;
  includeMetadata: boolean;
  cleanupLevel: 'minimal' | 'standard' | 'aggressive';
  customSettings: Record<string, any>;
}

// Batch processing result interfaces
export interface FileProcessingResult {
  filename: string;
  success: boolean;
  output?: StructuredContent;
  error?: string;
  processingTime: number;
}

export interface BatchResult {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: FileProcessingResult[];
  totalProcessingTime: number;
}

// Progress tracking interface
export interface ProcessingProgress {
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

// Re-export error types
export * from './errors';

// Re-export settings types
export * from './settings';
