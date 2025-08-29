import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROCESSING_PREFERENCES,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_FILE_PREFERENCES,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences,
  SettingsChangeEvent
} from '../models/settings';

describe('Settings Models', () => {
  describe('Default Settings', () => {
    it('should have valid default processing preferences', () => {
      expect(DEFAULT_PROCESSING_PREFERENCES).toEqual({
        defaultOutputFormat: 'plaintext',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        batchSize: 5,
        maxConcurrentFiles: 3
      });
    });

    it('should have valid default UI preferences', () => {
      expect(DEFAULT_UI_PREFERENCES).toEqual({
        showPreviewByDefault: true,
        autoSelectFirstResult: true,
        showProcessingDetails: false,
        confirmBeforeClearing: true,
        theme: 'auto'
      });
    });

    it('should have valid default file preferences', () => {
      expect(DEFAULT_FILE_PREFERENCES).toEqual({
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['.docx', '.doc'],
        autoCleanupTempFiles: true,
        defaultOutputDirectory: ''
      });
    });

    it('should have valid default app settings', () => {
      expect(DEFAULT_APP_SETTINGS.processing).toEqual(DEFAULT_PROCESSING_PREFERENCES);
      expect(DEFAULT_APP_SETTINGS.ui).toEqual(DEFAULT_UI_PREFERENCES);
      expect(DEFAULT_APP_SETTINGS.files).toEqual(DEFAULT_FILE_PREFERENCES);
      expect(DEFAULT_APP_SETTINGS.version).toBe('1.0.0');
      expect(DEFAULT_APP_SETTINGS.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Settings Validation', () => {
    it('should validate processing preferences', () => {
      const validProcessing: ProcessingPreferences = {
        defaultOutputFormat: 'html',
        preserveImages: true,
        includeMetadata: false,
        cleanupLevel: 'aggressive',
        batchSize: 10,
        maxConcurrentFiles: 5
      };

      expect(validProcessing.defaultOutputFormat).toMatch(/^(html|markdown|plaintext)$/);
      expect(typeof validProcessing.preserveImages).toBe('boolean');
      expect(typeof validProcessing.includeMetadata).toBe('boolean');
      expect(validProcessing.cleanupLevel).toMatch(/^(minimal|standard|aggressive)$/);
      expect(validProcessing.batchSize).toBeGreaterThan(0);
      expect(validProcessing.maxConcurrentFiles).toBeGreaterThan(0);
    });

    it('should validate UI preferences', () => {
      const validUI: UIPreferences = {
        showPreviewByDefault: false,
        autoSelectFirstResult: false,
        showProcessingDetails: true,
        confirmBeforeClearing: false,
        theme: 'dark'
      };

      expect(typeof validUI.showPreviewByDefault).toBe('boolean');
      expect(typeof validUI.autoSelectFirstResult).toBe('boolean');
      expect(typeof validUI.showProcessingDetails).toBe('boolean');
      expect(typeof validUI.confirmBeforeClearing).toBe('boolean');
      expect(validUI.theme).toMatch(/^(light|dark|auto)$/);
    });

    it('should validate file preferences', () => {
      const validFiles: FilePreferences = {
        maxFileSize: 50 * 1024 * 1024,
        allowedExtensions: ['.docx', '.doc', '.rtf'],
        autoCleanupTempFiles: false,
        defaultOutputDirectory: '/path/to/output'
      };

      expect(validFiles.maxFileSize).toBeGreaterThan(0);
      expect(Array.isArray(validFiles.allowedExtensions)).toBe(true);
      expect(validFiles.allowedExtensions.length).toBeGreaterThan(0);
      expect(typeof validFiles.autoCleanupTempFiles).toBe('boolean');
      expect(typeof validFiles.defaultOutputDirectory).toBe('string');
    });
  });

  describe('Settings Change Events', () => {
    it('should create valid settings change event', () => {
      const event: SettingsChangeEvent = {
        section: 'processing',
        key: 'defaultOutputFormat',
        oldValue: 'plaintext',
        newValue: 'html',
        timestamp: new Date()
      };

      expect(event.section).toBe('processing');
      expect(event.key).toBe('defaultOutputFormat');
      expect(event.oldValue).toBe('plaintext');
      expect(event.newValue).toBe('html');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different section types', () => {
      const sections: Array<keyof AppSettings> = ['processing', 'ui', 'files'];
      
      sections.forEach(section => {
        const event: SettingsChangeEvent = {
          section,
          key: 'testKey',
          oldValue: 'oldValue',
          newValue: 'newValue',
          timestamp: new Date()
        };

        expect(event.section).toBe(section);
      });
    });
  });

  describe('Settings Merging', () => {
    it('should merge partial settings with defaults', () => {
      const partialSettings: Partial<AppSettings> = {
        processing: {
          ...DEFAULT_PROCESSING_PREFERENCES,
          defaultOutputFormat: 'markdown'
        }
      };

      const merged: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...partialSettings
      };

      expect(merged.processing.defaultOutputFormat).toBe('markdown');
      expect(merged.processing.batchSize).toBe(DEFAULT_PROCESSING_PREFERENCES.batchSize);
      expect(merged.ui).toEqual(DEFAULT_UI_PREFERENCES);
      expect(merged.files).toEqual(DEFAULT_FILE_PREFERENCES);
    });

    it('should handle deep merging of nested objects', () => {
      const partialProcessing: Partial<ProcessingPreferences> = {
        defaultOutputFormat: 'html',
        batchSize: 10
      };

      const merged: ProcessingPreferences = {
        ...DEFAULT_PROCESSING_PREFERENCES,
        ...partialProcessing
      };

      expect(merged.defaultOutputFormat).toBe('html');
      expect(merged.batchSize).toBe(10);
      expect(merged.preserveImages).toBe(DEFAULT_PROCESSING_PREFERENCES.preserveImages);
      expect(merged.cleanupLevel).toBe(DEFAULT_PROCESSING_PREFERENCES.cleanupLevel);
    });
  });

  describe('Settings Serialization', () => {
    it('should serialize and deserialize settings correctly', () => {
      const originalSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_PROCESSING_PREFERENCES,
          defaultOutputFormat: 'markdown'
        },
        lastUpdated: new Date('2023-01-01T00:00:00.000Z')
      };

      const serialized = JSON.stringify(originalSettings);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.processing.defaultOutputFormat).toBe('markdown');
      expect(deserialized.version).toBe(originalSettings.version);
      expect(typeof deserialized.lastUpdated).toBe('string'); // Date becomes string in JSON
    });

    it('should handle date conversion after deserialization', () => {
      const originalDate = new Date('2023-01-01T00:00:00.000Z');
      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        lastUpdated: originalDate
      };

      const serialized = JSON.stringify(settings);
      const deserialized = JSON.parse(serialized);
      
      // Convert string back to Date
      deserialized.lastUpdated = new Date(deserialized.lastUpdated);

      expect(deserialized.lastUpdated).toBeInstanceOf(Date);
      expect(deserialized.lastUpdated.getTime()).toBe(originalDate.getTime());
    });
  });
});