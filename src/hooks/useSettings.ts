import { useState, useEffect, useCallback } from 'react';
import {
  AppSettings,
  SettingsChangeEvent,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences
} from '../models/settings';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

export interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

export interface SettingsActions {
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateProcessingSettings: (updates: Partial<ProcessingPreferences>) => Promise<void>;
  updateUISettings: (updates: Partial<UIPreferences>) => Promise<void>;
  updateFileSettings: (updates: Partial<FilePreferences>) => Promise<void>;
  resetSettings: () => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<void>;
  clearError: () => void;
}

export const useSettings = (): [SettingsState, SettingsActions] => {
  const [state, setState] = useState<SettingsState>({
    settings: null,
    loading: false,
    error: null,
    hasUnsavedChanges: false
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = settingsService.onSettingsChange((event: SettingsChangeEvent) => {
      logger.info('settings', 'Settings changed', {
        section: event.section,
        key: event.key,
        timestamp: event.timestamp
      });
    });

    return unsubscribe;
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const settings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to load settings', error);
    }
  }, []);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.saveSettings(settings);
      
      setState(prev => ({
        ...prev,
        settings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to save settings', error);
      throw error;
    }
  }, []);

  const updateProcessingSettings = useCallback(async (updates: Partial<ProcessingPreferences>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.updateSettings('processing', updates);
      const updatedSettings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings: updatedSettings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update processing settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to update processing settings', error);
      throw error;
    }
  }, []);

  const updateUISettings = useCallback(async (updates: Partial<UIPreferences>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.updateSettings('ui', updates);
      const updatedSettings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings: updatedSettings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update UI settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to update UI settings', error);
      throw error;
    }
  }, []);

  const updateFileSettings = useCallback(async (updates: Partial<FilePreferences>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.updateSettings('files', updates);
      const updatedSettings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings: updatedSettings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update file settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to update file settings', error);
      throw error;
    }
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.resetSettings();
      const resetSettings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings: resetSettings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to reset settings', error);
      throw error;
    }
  }, []);

  const exportSettings = useCallback(async (): Promise<string> => {
    try {
      return await settingsService.exportSettings();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export settings';
      setState(prev => ({ ...prev, error: errorMessage }));
      logger.error('settings', 'Failed to export settings', error);
      throw error;
    }
  }, []);

  const importSettings = useCallback(async (settingsJson: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await settingsService.importSettings(settingsJson);
      const importedSettings = await settingsService.loadSettings();
      
      setState(prev => ({
        ...prev,
        settings: importedSettings,
        loading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      logger.error('settings', 'Failed to import settings', error);
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: SettingsActions = {
    loadSettings,
    saveSettings,
    updateProcessingSettings,
    updateUISettings,
    updateFileSettings,
    resetSettings,
    exportSettings,
    importSettings,
    clearError
  };

  return [state, actions];
};