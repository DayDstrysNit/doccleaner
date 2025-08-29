// Settings and configuration models

export type OutputFormat = 'html' | 'markdown' | 'plaintext';
export type CleanupLevel = 'minimal' | 'standard' | 'aggressive';

// User preferences for processing behavior
export interface ProcessingPreferences {
  defaultOutputFormat: OutputFormat;
  preserveImages: boolean;
  includeMetadata: boolean;
  cleanupLevel: CleanupLevel;
  batchSize: number;
  maxConcurrentFiles: number;
}

// UI preferences
export interface UIPreferences {
  showPreviewByDefault: boolean;
  autoSelectFirstResult: boolean;
  showProcessingDetails: boolean;
  confirmBeforeClearing: boolean;
  theme: 'light' | 'dark' | 'auto';
}

// File handling preferences
export interface FilePreferences {
  maxFileSize: number; // in bytes
  allowedExtensions: string[];
  autoCleanupTempFiles: boolean;
  defaultOutputDirectory: string;
}

// Application settings interface
export interface AppSettings {
  processing: ProcessingPreferences;
  ui: UIPreferences;
  files: FilePreferences;
  version: string;
  lastUpdated: Date;
}

// Default settings
export const DEFAULT_PROCESSING_PREFERENCES: ProcessingPreferences = {
  defaultOutputFormat: 'plaintext',
  preserveImages: false,
  includeMetadata: false,
  cleanupLevel: 'standard',
  batchSize: 5,
  maxConcurrentFiles: 3
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  showPreviewByDefault: true,
  autoSelectFirstResult: true,
  showProcessingDetails: false,
  confirmBeforeClearing: true,
  theme: 'auto'
};

export const DEFAULT_FILE_PREFERENCES: FilePreferences = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedExtensions: ['.docx', '.doc'],
  autoCleanupTempFiles: true,
  defaultOutputDirectory: ''
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  processing: DEFAULT_PROCESSING_PREFERENCES,
  ui: DEFAULT_UI_PREFERENCES,
  files: DEFAULT_FILE_PREFERENCES,
  version: '1.0.0',
  lastUpdated: new Date()
};

// Settings validation interface
export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Settings change event
export interface SettingsChangeEvent {
  section: keyof AppSettings;
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}