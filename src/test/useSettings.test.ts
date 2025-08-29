import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../hooks/useSettings';
import { settingsService } from '../services/settingsService';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences
} from '../models/settings';

import { vi } from 'vitest';

// Mock the settings service
vi.mock('../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    exportSettings: vi.fn(),
    importSettings: vi.fn(),
    onSettingsChange: vi.fn(() => () => {}), // Return unsubscribe function
  }
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  }
}));

const mockSettingsService = settingsService as any;

describe('useSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsService.loadSettings.mockResolvedValue(DEFAULT_APP_SETTINGS);
  });

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useSettings());
      const [state] = result.current;

      expect(state.settings).toBeNull();
      expect(state.loading).toBe(false); // Will be true briefly during loadSettings
      expect(state.error).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should load settings on mount', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for the effect to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockSettingsService.loadSettings).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to settings changes on mount', () => {
      renderHook(() => useSettings());

      expect(mockSettingsService.onSettingsChange).toHaveBeenCalledTimes(1);
      expect(mockSettingsService.onSettingsChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('loadSettings', () => {
    it('should load settings successfully', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(testSettings);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        await actions.loadSettings();
      });

      const [state] = result.current;
      expect(state.settings?.processing.defaultOutputFormat).toBe('html');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle loading errors', async () => {
      const errorMessage = 'Failed to load settings';
      mockSettingsService.loadSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        await actions.loadSettings();
      });

      const [state] = result.current;
      expect(state.settings).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('saveSettings', () => {
    it('should save settings successfully', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'markdown'
        }
      };

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        await actions.saveSettings(testSettings);
      });

      expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(testSettings);

      const [state] = result.current;
      expect(state.settings?.processing.defaultOutputFormat).toBe('markdown');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle save errors', async () => {
      const errorMessage = 'Failed to save settings';
      mockSettingsService.saveSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        try {
          await actions.saveSettings(DEFAULT_APP_SETTINGS);
        } catch (error) {
          // Expected to throw
        }
      });

      const [state] = result.current;
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('updateProcessingSettings', () => {
    it('should update processing settings', async () => {
      const updatedSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(updatedSettings);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      const updates: Partial<ProcessingPreferences> = {
        defaultOutputFormat: 'html'
      };

      await act(async () => {
        await actions.updateProcessingSettings(updates);
      });

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith('processing', updates);
      expect(mockSettingsService.loadSettings).toHaveBeenCalledTimes(2); // Once on mount, once after update

      const [state] = result.current;
      expect(state.settings?.processing.defaultOutputFormat).toBe('html');
    });

    it('should handle processing settings update errors', async () => {
      const errorMessage = 'Failed to update processing settings';
      mockSettingsService.updateSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        try {
          await actions.updateProcessingSettings({ defaultOutputFormat: 'html' });
        } catch (error) {
          // Expected to throw
        }
      });

      const [state] = result.current;
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('updateUISettings', () => {
    it('should update UI settings', async () => {
      const updatedSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ui: {
          ...DEFAULT_APP_SETTINGS.ui,
          theme: 'dark'
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(updatedSettings);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      const updates: Partial<UIPreferences> = {
        theme: 'dark'
      };

      await act(async () => {
        await actions.updateUISettings(updates);
      });

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith('ui', updates);

      const [state] = result.current;
      expect(state.settings?.ui.theme).toBe('dark');
    });
  });

  describe('updateFileSettings', () => {
    it('should update file settings', async () => {
      const updatedSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        files: {
          ...DEFAULT_APP_SETTINGS.files,
          maxFileSize: 200 * 1024 * 1024
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(updatedSettings);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      const updates: Partial<FilePreferences> = {
        maxFileSize: 200 * 1024 * 1024
      };

      await act(async () => {
        await actions.updateFileSettings(updates);
      });

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith('files', updates);

      const [state] = result.current;
      expect(state.settings?.files.maxFileSize).toBe(200 * 1024 * 1024);
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', async () => {
      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        await actions.resetSettings();
      });

      expect(mockSettingsService.resetSettings).toHaveBeenCalledTimes(1);
      expect(mockSettingsService.loadSettings).toHaveBeenCalledTimes(2); // Once on mount, once after reset

      const [state] = result.current;
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle reset errors', async () => {
      const errorMessage = 'Failed to reset settings';
      mockSettingsService.resetSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        try {
          await actions.resetSettings();
        } catch (error) {
          // Expected to throw
        }
      });

      const [state] = result.current;
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('exportSettings', () => {
    it('should export settings as JSON string', async () => {
      const exportedJson = JSON.stringify(DEFAULT_APP_SETTINGS);
      mockSettingsService.exportSettings.mockResolvedValue(exportedJson);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      let exported: string = '';
      await act(async () => {
        exported = await actions.exportSettings();
      });

      expect(mockSettingsService.exportSettings).toHaveBeenCalledTimes(1);
      expect(exported).toBe(exportedJson);
    });

    it('should handle export errors', async () => {
      const errorMessage = 'Failed to export settings';
      mockSettingsService.exportSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        try {
          await actions.exportSettings();
        } catch (error) {
          // Expected to throw
        }
      });

      const [state] = result.current;
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('importSettings', () => {
    it('should import settings from JSON string', async () => {
      const importedSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html'
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(importedSettings);

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      const settingsJson = JSON.stringify(importedSettings);

      await act(async () => {
        await actions.importSettings(settingsJson);
      });

      expect(mockSettingsService.importSettings).toHaveBeenCalledWith(settingsJson);
      expect(mockSettingsService.loadSettings).toHaveBeenCalledTimes(2); // Once on mount, once after import

      const [state] = result.current;
      expect(state.settings?.processing.defaultOutputFormat).toBe('html');
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle import errors', async () => {
      const errorMessage = 'Failed to import settings';
      mockSettingsService.importSettings.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        try {
          await actions.importSettings('invalid json');
        } catch (error) {
          // Expected to throw
        }
      });

      const [state] = result.current;
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      // First set an error
      mockSettingsService.loadSettings.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useSettings());
      const [, actions] = result.current;

      await act(async () => {
        await actions.loadSettings();
      });

      // Verify error is set
      expect(result.current[0].error).toBe('Test error');

      // Clear the error
      act(() => {
        actions.clearError();
      });

      // Verify error is cleared
      const [state] = result.current;
      expect(state.error).toBeNull();
    });
  });
});