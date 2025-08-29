// Settings service for persistent storage and management

import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  SettingsValidationResult,
  SettingsChangeEvent,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences
} from '../models/settings';
import { logger } from './logger';

export interface SettingsService {
  /**
   * Load settings from persistent storage
   */
  loadSettings(): Promise<AppSettings>;
  
  /**
   * Save settings to persistent storage
   */
  saveSettings(settings: AppSettings): Promise<void>;
  
  /**
   * Update specific settings section
   */
  updateSettings<T extends keyof AppSettings>(
    section: T,
    updates: Partial<AppSettings[T]>
  ): Promise<void>;
  
  /**
   * Reset settings to defaults
   */
  resetSettings(): Promise<void>;
  
  /**
   * Validate settings
   */
  validateSettings(settings: AppSettings): SettingsValidationResult;
  
  /**
   * Subscribe to settings changes
   */
  onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void;
  
  /**
   * Export settings to file
   */
  exportSettings(): Promise<string>;
  
  /**
   * Import settings from file content
   */
  importSettings(settingsJson: string): Promise<void>;
}

/**
 * Local storage implementation of settings service
 * In a real Electron app, this would use the main process for file system access
 */
export class LocalStorageSettingsService implements SettingsService {
  private static readonly STORAGE_KEY = 'docx-converter-settings';
  private static readonly SETTINGS_VERSION = '1.0.0';
  
  private changeListeners: ((event: SettingsChangeEvent) => void)[] = [];
  private currentSettings: AppSettings | null = null;

  async loadSettings(): Promise<AppSettings> {
    try {
      const stored = localStorage.getItem(LocalStorageSettingsService.STORAGE_KEY);
      
      if (!stored) {
        logger.info('settings', 'No stored settings found, using defaults');
        this.currentSettings = { ...DEFAULT_APP_SETTINGS };
        await this.saveSettings(this.currentSettings);
        return this.currentSettings;
      }

      const parsed = JSON.parse(stored) as AppSettings;
      
      // Convert date strings back to Date objects
      parsed.lastUpdated = new Date(parsed.lastUpdated);
      
      // Validate and migrate settings if needed
      const validation = this.validateSettings(parsed);
      if (!validation.isValid) {
        logger.warn('settings', 'Invalid settings found, using defaults', { errors: validation.errors });
        this.currentSettings = { ...DEFAULT_APP_SETTINGS };
        await this.saveSettings(this.currentSettings);
        return this.currentSettings;
      }

      // Merge with defaults to ensure all properties exist
      this.currentSettings = this.mergeWithDefaults(parsed);
      
      logger.info('settings', 'Settings loaded successfully');
      return this.currentSettings;
      
    } catch (error) {
      logger.error('settings', 'Failed to load settings', error);
      this.currentSettings = { ...DEFAULT_APP_SETTINGS };
      await this.saveSettings(this.currentSettings);
      return this.currentSettings;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const validation = this.validateSettings(settings);
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      settings.lastUpdated = new Date();
      settings.version = LocalStorageSettingsService.SETTINGS_VERSION;

      const serialized = JSON.stringify(settings, null, 2);
      localStorage.setItem(LocalStorageSettingsService.STORAGE_KEY, serialized);
      
      this.currentSettings = { ...settings };
      logger.info('settings', 'Settings saved successfully');
      
    } catch (error) {
      logger.error('settings', 'Failed to save settings', error);
      throw error;
    }
  }

  async updateSettings<T extends keyof AppSettings>(
    section: T,
    updates: Partial<AppSettings[T]>
  ): Promise<void> {
    const currentSettings = this.currentSettings || await this.loadSettings();
    
    // Create change events for each updated property
    const changeEvents: SettingsChangeEvent[] = [];
    
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = (currentSettings[section] as any)[key];
      if (oldValue !== newValue) {
        changeEvents.push({
          section,
          key,
          oldValue,
          newValue,
          timestamp: new Date()
        });
      }
    }

    // Update the settings
    const updatedSettings: AppSettings = {
      ...currentSettings,
      [section]: {
        ...currentSettings[section],
        ...updates
      }
    };

    await this.saveSettings(updatedSettings);

    // Notify listeners of changes
    changeEvents.forEach(event => {
      this.changeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          logger.error('settings', 'Error in settings change listener', error);
        }
      });
    });
  }

  async resetSettings(): Promise<void> {
    logger.info('settings', 'Resetting settings to defaults');
    await this.saveSettings({ ...DEFAULT_APP_SETTINGS });
  }

  validateSettings(settings: AppSettings): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate processing preferences
      if (!settings.processing) {
        errors.push('Missing processing preferences');
      } else {
        const { processing } = settings;
        
        if (!['html', 'markdown', 'plaintext'].includes(processing.defaultOutputFormat)) {
          errors.push('Invalid default output format');
        }
        
        if (typeof processing.preserveImages !== 'boolean') {
          errors.push('preserveImages must be boolean');
        }
        
        if (typeof processing.includeMetadata !== 'boolean') {
          errors.push('includeMetadata must be boolean');
        }
        
        if (!['minimal', 'standard', 'aggressive'].includes(processing.cleanupLevel)) {
          errors.push('Invalid cleanup level');
        }
        
        if (processing.batchSize < 1 || processing.batchSize > 50) {
          errors.push('Batch size must be between 1 and 50');
        }
        
        if (processing.maxConcurrentFiles < 1 || processing.maxConcurrentFiles > 10) {
          errors.push('Max concurrent files must be between 1 and 10');
        }
      }

      // Validate UI preferences
      if (!settings.ui) {
        errors.push('Missing UI preferences');
      } else {
        const { ui } = settings;
        
        if (typeof ui.showPreviewByDefault !== 'boolean') {
          errors.push('showPreviewByDefault must be boolean');
        }
        
        if (typeof ui.autoSelectFirstResult !== 'boolean') {
          errors.push('autoSelectFirstResult must be boolean');
        }
        
        if (typeof ui.showProcessingDetails !== 'boolean') {
          errors.push('showProcessingDetails must be boolean');
        }
        
        if (typeof ui.confirmBeforeClearing !== 'boolean') {
          errors.push('confirmBeforeClearing must be boolean');
        }
        
        if (!['light', 'dark', 'auto'].includes(ui.theme)) {
          errors.push('Invalid theme');
        }
      }

      // Validate file preferences
      if (!settings.files) {
        errors.push('Missing file preferences');
      } else {
        const { files } = settings;
        
        if (files.maxFileSize < 1024 * 1024) { // 1MB minimum
          warnings.push('Max file size is very small (< 1MB)');
        }
        
        if (files.maxFileSize > 500 * 1024 * 1024) { // 500MB maximum
          warnings.push('Max file size is very large (> 500MB)');
        }
        
        if (!Array.isArray(files.allowedExtensions) || files.allowedExtensions.length === 0) {
          errors.push('allowedExtensions must be a non-empty array');
        }
        
        if (typeof files.autoCleanupTempFiles !== 'boolean') {
          errors.push('autoCleanupTempFiles must be boolean');
        }
      }

      // Validate version and timestamp
      if (!settings.version) {
        warnings.push('Missing version information');
      }
      
      if (!settings.lastUpdated || !(settings.lastUpdated instanceof Date)) {
        warnings.push('Invalid lastUpdated timestamp');
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  onSettingsChange(callback: (event: SettingsChangeEvent) => void): () => void {
    this.changeListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  async exportSettings(): Promise<string> {
    const settings = this.currentSettings || await this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  async importSettings(settingsJson: string): Promise<void> {
    try {
      const imported = JSON.parse(settingsJson) as AppSettings;
      
      // Convert date strings to Date objects
      if (imported.lastUpdated) {
        imported.lastUpdated = new Date(imported.lastUpdated);
      }
      
      const validation = this.validateSettings(imported);
      if (!validation.isValid) {
        throw new Error(`Invalid settings file: ${validation.errors.join(', ')}`);
      }

      await this.saveSettings(imported);
      logger.info('settings', 'Settings imported successfully');
      
    } catch (error) {
      logger.error('settings', 'Failed to import settings', error);
      throw error;
    }
  }

  private mergeWithDefaults(settings: AppSettings): AppSettings {
    return {
      processing: { ...DEFAULT_APP_SETTINGS.processing, ...settings.processing },
      ui: { ...DEFAULT_APP_SETTINGS.ui, ...settings.ui },
      files: { ...DEFAULT_APP_SETTINGS.files, ...settings.files },
      version: settings.version || DEFAULT_APP_SETTINGS.version,
      lastUpdated: settings.lastUpdated || new Date()
    };
  }
}

// Global settings service instance
export const settingsService = new LocalStorageSettingsService();