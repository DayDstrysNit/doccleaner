import {
  LocalStorageSettingsService,
  SettingsService
} from '../services/settingsService';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences,
  SettingsChangeEvent
} from '../models/settings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('LocalStorageSettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    localStorageMock.clear();
    settingsService = new LocalStorageSettingsService();
  });

  describe('loadSettings', () => {
    it('should return default settings when no stored settings exist', async () => {
      const settings = await settingsService.loadSettings();

      expect(settings.processing).toEqual(DEFAULT_APP_SETTINGS.processing);
      expect(settings.ui).toEqual(DEFAULT_APP_SETTINGS.ui);
      expect(settings.files).toEqual(DEFAULT_APP_SETTINGS.files);
      expect(settings.version).toBe('1.0.0');
      expect(settings.lastUpdated).toBeInstanceOf(Date);
    });

    it('should load stored settings correctly', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'markdown'
        },
        lastUpdated: new Date('2023-01-01T00:00:00.000Z')
      };

      localStorageMock.setItem('docx-converter-settings', JSON.stringify(testSettings));

      const loadedSettings = await settingsService.loadSettings();

      expect(loadedSettings.processing.defaultOutputFormat).toBe('markdown');
      expect(loadedSettings.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle corrupted stored settings by returning defaults', async () => {
      localStorageMock.setItem('docx-converter-settings', 'invalid json');

      const settings = await settingsService.loadSettings();

      expect(settings).toEqual(expect.objectContaining({
        processing: DEFAULT_APP_SETTINGS.processing,
        ui: DEFAULT_APP_SETTINGS.ui,
        files: DEFAULT_APP_SETTINGS.files
      }));
    });

    it('should merge stored settings with defaults for missing properties', async () => {
      const partialSettings = {
        processing: {
          defaultOutputFormat: 'html',
          preserveImages: false,
          includeMetadata: false,
          cleanupLevel: 'standard',
          batchSize: 5,
          maxConcurrentFiles: 3
        },
        ui: DEFAULT_APP_SETTINGS.ui,
        files: DEFAULT_APP_SETTINGS.files,
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      };

      localStorageMock.setItem('docx-converter-settings', JSON.stringify(partialSettings));

      const loadedSettings = await settingsService.loadSettings();

      expect(loadedSettings.processing.defaultOutputFormat).toBe('html');
      expect(loadedSettings.processing.batchSize).toBe(DEFAULT_APP_SETTINGS.processing.batchSize);
      expect(loadedSettings.ui).toEqual(DEFAULT_APP_SETTINGS.ui);
      expect(loadedSettings.files).toEqual(DEFAULT_APP_SETTINGS.files);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        }
      };

      await settingsService.saveSettings(testSettings);

      const stored = localStorageMock.getItem('docx-converter-settings');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.processing.defaultOutputFormat).toBe('html');
      expect(parsed.version).toBe('1.0.0');
    });

    it('should update lastUpdated timestamp when saving', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        lastUpdated: new Date('2020-01-01T00:00:00.000Z')
      };

      const beforeSave = Date.now();
      await settingsService.saveSettings(testSettings);
      const afterSave = Date.now();

      const stored = localStorageMock.getItem('docx-converter-settings');
      const parsed = JSON.parse(stored!);
      const savedTimestamp = new Date(parsed.lastUpdated).getTime();

      expect(savedTimestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(savedTimestamp).toBeLessThanOrEqual(afterSave);
    });

    it('should reject invalid settings', async () => {
      const invalidSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'invalid' as any
        }
      };

      await expect(settingsService.saveSettings(invalidSettings)).rejects.toThrow();
    });
  });

  describe('updateSettings', () => {
    it('should update processing settings', async () => {
      // First load default settings
      await settingsService.loadSettings();

      const updates: Partial<ProcessingPreferences> = {
        defaultOutputFormat: 'markdown',
        batchSize: 10
      };

      await settingsService.updateSettings('processing', updates);

      const updatedSettings = await settingsService.loadSettings();
      expect(updatedSettings.processing.defaultOutputFormat).toBe('markdown');
      expect(updatedSettings.processing.batchSize).toBe(10);
      expect(updatedSettings.processing.preserveImages).toBe(DEFAULT_APP_SETTINGS.processing.preserveImages);
    });

    it('should update UI settings', async () => {
      await settingsService.loadSettings();

      const updates: Partial<UIPreferences> = {
        theme: 'dark',
        showPreviewByDefault: false
      };

      await settingsService.updateSettings('ui', updates);

      const updatedSettings = await settingsService.loadSettings();
      expect(updatedSettings.ui.theme).toBe('dark');
      expect(updatedSettings.ui.showPreviewByDefault).toBe(false);
      expect(updatedSettings.ui.autoSelectFirstResult).toBe(DEFAULT_APP_SETTINGS.ui.autoSelectFirstResult);
    });

    it('should update file settings', async () => {
      await settingsService.loadSettings();

      const updates: Partial<FilePreferences> = {
        maxFileSize: 200 * 1024 * 1024,
        allowedExtensions: ['.docx', '.doc', '.rtf']
      };

      await settingsService.updateSettings('files', updates);

      const updatedSettings = await settingsService.loadSettings();
      expect(updatedSettings.files.maxFileSize).toBe(200 * 1024 * 1024);
      expect(updatedSettings.files.allowedExtensions).toEqual(['.docx', '.doc', '.rtf']);
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', async () => {
      // First set some custom settings
      const customSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        },
        ui: {
          ...DEFAULT_APP_SETTINGS.ui,
          theme: 'dark'
        }
      };

      await settingsService.saveSettings(customSettings);

      // Reset to defaults
      await settingsService.resetSettings();

      const resetSettings = await settingsService.loadSettings();
      expect(resetSettings.processing.defaultOutputFormat).toBe(DEFAULT_APP_SETTINGS.processing.defaultOutputFormat);
      expect(resetSettings.ui.theme).toBe(DEFAULT_APP_SETTINGS.ui.theme);
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const validSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          defaultOutputFormat: 'html',
          preserveImages: true,
          includeMetadata: false,
          cleanupLevel: 'aggressive',
          batchSize: 10,
          maxConcurrentFiles: 5
        }
      };

      const result = settingsService.validateSettings(validSettings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid processing settings', () => {
      const invalidSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          defaultOutputFormat: 'invalid' as any,
          preserveImages: 'not-boolean' as any,
          includeMetadata: false,
          cleanupLevel: 'standard',
          batchSize: 0,
          maxConcurrentFiles: 15
        }
      };

      const result = settingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid default output format'))).toBe(true);
      expect(result.errors.some(error => error.includes('preserveImages must be boolean'))).toBe(true);
      expect(result.errors.some(error => error.includes('Batch size must be between 1 and 50'))).toBe(true);
      expect(result.errors.some(error => error.includes('Max concurrent files must be between 1 and 10'))).toBe(true);
    });

    it('should detect invalid UI settings', () => {
      const invalidSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ui: {
          showPreviewByDefault: 'not-boolean' as any,
          autoSelectFirstResult: true,
          showProcessingDetails: false,
          confirmBeforeClearing: true,
          theme: 'invalid' as any
        }
      };

      const result = settingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('showPreviewByDefault must be boolean'))).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid theme'))).toBe(true);
    });

    it('should detect invalid file settings', () => {
      const invalidSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        files: {
          maxFileSize: 0,
          allowedExtensions: [],
          autoCleanupTempFiles: 'not-boolean' as any,
          defaultOutputDirectory: ''
        }
      };

      const result = settingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('allowedExtensions must be a non-empty array'))).toBe(true);
      expect(result.errors.some(error => error.includes('autoCleanupTempFiles must be boolean'))).toBe(true);
    });

    it('should generate warnings for edge cases', () => {
      const edgeCaseSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        files: {
          ...DEFAULT_APP_SETTINGS.files,
          maxFileSize: 500 * 1024, // 500KB - very small
        }
      };

      const result = settingsService.validateSettings(edgeCaseSettings);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Max file size is very small'))).toBe(true);
    });
  });

  describe('settings change events', () => {
    it('should notify listeners of settings changes', async () => {
      const changeEvents: SettingsChangeEvent[] = [];
      
      const unsubscribe = settingsService.onSettingsChange((event) => {
        changeEvents.push(event);
      });

      await settingsService.loadSettings();
      await settingsService.updateSettings('processing', { defaultOutputFormat: 'html' });

      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0].section).toBe('processing');
      expect(changeEvents[0].key).toBe('defaultOutputFormat');
      expect(changeEvents[0].newValue).toBe('html');

      unsubscribe();
    });

    it('should allow unsubscribing from change events', async () => {
      const changeEvents: SettingsChangeEvent[] = [];
      
      const unsubscribe = settingsService.onSettingsChange((event) => {
        changeEvents.push(event);
      });

      await settingsService.loadSettings();
      unsubscribe();
      
      await settingsService.updateSettings('processing', { defaultOutputFormat: 'html' });

      expect(changeEvents).toHaveLength(0);
    });
  });

  describe('export and import', () => {
    it('should export settings as JSON string', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'markdown'
        }
      };

      await settingsService.saveSettings(testSettings);
      const exported = await settingsService.exportSettings();

      const parsed = JSON.parse(exported);
      expect(parsed.processing.defaultOutputFormat).toBe('markdown');
    });

    it('should import settings from JSON string', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        }
      };

      const settingsJson = JSON.stringify(testSettings);
      await settingsService.importSettings(settingsJson);

      const loadedSettings = await settingsService.loadSettings();
      expect(loadedSettings.processing.defaultOutputFormat).toBe('html');
    });

    it('should reject invalid JSON during import', async () => {
      await expect(settingsService.importSettings('invalid json')).rejects.toThrow();
    });

    it('should reject invalid settings during import', async () => {
      const invalidSettings = {
        processing: {
          defaultOutputFormat: 'invalid'
        }
      };

      const settingsJson = JSON.stringify(invalidSettings);
      await expect(settingsService.importSettings(settingsJson)).rejects.toThrow();
    });
  });
});