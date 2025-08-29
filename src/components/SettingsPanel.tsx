import React, { useState, useEffect } from 'react';
import {
  AppSettings,
  ProcessingPreferences,
  UIPreferences,
  FilePreferences,
  OutputFormat,
  CleanupLevel
} from '../models/settings';
import { settingsService } from '../services/settingsService';
import './SettingsPanel.css';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: AppSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'processing' | 'ui' | 'files'>('processing');
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when panel opens
  useEffect(() => {
    if (isOpen && !settings) {
      loadSettings();
    }
  }, [isOpen, settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      await settingsService.saveSettings(settings);
      setHasChanges(false);
      onSettingsChange?.(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await settingsService.resetSettings();
      const resetSettings = await settingsService.loadSettings();
      setSettings(resetSettings);
      setHasChanges(false);
      onSettingsChange?.(resetSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const exported = await settingsService.exportSettings();
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'docx-converter-settings.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export settings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      await settingsService.importSettings(content);
      const importedSettings = await settingsService.loadSettings();
      setSettings(importedSettings);
      setHasChanges(false);
      onSettingsChange?.(importedSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import settings');
    }
  };

  const updateProcessingSettings = (updates: Partial<ProcessingPreferences>) => {
    if (!settings) return;
    
    setSettings(prev => prev ? {
      ...prev,
      processing: { ...prev.processing, ...updates }
    } : null);
    setHasChanges(true);
  };

  const updateUISettings = (updates: Partial<UIPreferences>) => {
    if (!settings) return;
    
    setSettings(prev => prev ? {
      ...prev,
      ui: { ...prev.ui, ...updates }
    } : null);
    setHasChanges(true);
  };

  const updateFileSettings = (updates: Partial<FilePreferences>) => {
    if (!settings) return;
    
    setSettings(prev => prev ? {
      ...prev,
      files: { ...prev.files, ...updates }
    } : null);
    setHasChanges(true);
  };

  const handleClose = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Application Settings</h2>
          <button className="close-button" onClick={handleClose} aria-label="Close settings">
            ×
          </button>
        </div>

        {loading && (
          <div className="settings-loading">
            <p>Loading settings...</p>
          </div>
        )}

        {error && (
          <div className="settings-error">
            <p>Error: {error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {settings && (
          <>
            <div className="settings-tabs">
              <button
                className={`tab ${activeTab === 'processing' ? 'active' : ''}`}
                onClick={() => setActiveTab('processing')}
              >
                Processing
              </button>
              <button
                className={`tab ${activeTab === 'ui' ? 'active' : ''}`}
                onClick={() => setActiveTab('ui')}
              >
                Interface
              </button>
              <button
                className={`tab ${activeTab === 'files' ? 'active' : ''}`}
                onClick={() => setActiveTab('files')}
              >
                Files
              </button>
            </div>

            <div className="settings-content">
              {activeTab === 'processing' && (
                <div className="settings-section">
                  <h3>Processing Options</h3>
                  
                  <div className="setting-group">
                    <label htmlFor="defaultOutputFormat">Default Output Format:</label>
                    <select
                      id="defaultOutputFormat"
                      value={settings.processing.defaultOutputFormat}
                      onChange={(e) => updateProcessingSettings({
                        defaultOutputFormat: e.target.value as OutputFormat
                      })}
                    >
                      <option value="plaintext">Plain Text</option>
                      <option value="html">HTML</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="cleanupLevel">Cleanup Level:</label>
                    <select
                      id="cleanupLevel"
                      value={settings.processing.cleanupLevel}
                      onChange={(e) => updateProcessingSettings({
                        cleanupLevel: e.target.value as CleanupLevel
                      })}
                    >
                      <option value="minimal">Minimal - Keep most formatting</option>
                      <option value="standard">Standard - Remove common formatting</option>
                      <option value="aggressive">Aggressive - Remove all formatting</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.processing.preserveImages}
                        onChange={(e) => updateProcessingSettings({
                          preserveImages: e.target.checked
                        })}
                      />
                      Preserve Images
                    </label>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.processing.includeMetadata}
                        onChange={(e) => updateProcessingSettings({
                          includeMetadata: e.target.checked
                        })}
                      />
                      Include Document Metadata
                    </label>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="batchSize">Batch Size:</label>
                    <input
                      type="number"
                      id="batchSize"
                      min="1"
                      max="50"
                      value={settings.processing.batchSize}
                      onChange={(e) => updateProcessingSettings({
                        batchSize: parseInt(e.target.value, 10)
                      })}
                    />
                    <small>Number of files to process simultaneously</small>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="maxConcurrentFiles">Max Concurrent Files:</label>
                    <input
                      type="number"
                      id="maxConcurrentFiles"
                      min="1"
                      max="10"
                      value={settings.processing.maxConcurrentFiles}
                      onChange={(e) => updateProcessingSettings({
                        maxConcurrentFiles: parseInt(e.target.value, 10)
                      })}
                    />
                    <small>Maximum files processed at the same time</small>
                  </div>
                </div>
              )}

              {activeTab === 'ui' && (
                <div className="settings-section">
                  <h3>Interface Preferences</h3>
                  
                  <div className="setting-group">
                    <label htmlFor="theme">Theme:</label>
                    <select
                      id="theme"
                      value={settings.ui.theme}
                      onChange={(e) => updateUISettings({
                        theme: e.target.value as 'light' | 'dark' | 'auto'
                      })}
                    >
                      <option value="auto">Auto (System)</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.ui.showPreviewByDefault}
                        onChange={(e) => updateUISettings({
                          showPreviewByDefault: e.target.checked
                        })}
                      />
                      Show Preview by Default
                    </label>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.ui.autoSelectFirstResult}
                        onChange={(e) => updateUISettings({
                          autoSelectFirstResult: e.target.checked
                        })}
                      />
                      Auto-select First Result
                    </label>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.ui.showProcessingDetails}
                        onChange={(e) => updateUISettings({
                          showProcessingDetails: e.target.checked
                        })}
                      />
                      Show Processing Details
                    </label>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.ui.confirmBeforeClearing}
                        onChange={(e) => updateUISettings({
                          confirmBeforeClearing: e.target.checked
                        })}
                      />
                      Confirm Before Clearing Results
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'files' && (
                <div className="settings-section">
                  <h3>File Handling</h3>
                  
                  <div className="setting-group">
                    <label htmlFor="maxFileSize">Max File Size (MB):</label>
                    <input
                      type="number"
                      id="maxFileSize"
                      min="1"
                      max="500"
                      value={Math.round(settings.files.maxFileSize / (1024 * 1024))}
                      onChange={(e) => updateFileSettings({
                        maxFileSize: parseInt(e.target.value, 10) * 1024 * 1024
                      })}
                    />
                    <small>Maximum size for uploaded files</small>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="allowedExtensions">Allowed Extensions:</label>
                    <input
                      type="text"
                      id="allowedExtensions"
                      value={settings.files.allowedExtensions.join(', ')}
                      onChange={(e) => updateFileSettings({
                        allowedExtensions: e.target.value.split(',').map(ext => ext.trim())
                      })}
                    />
                    <small>Comma-separated list of allowed file extensions</small>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="defaultOutputDirectory">Default Output Directory:</label>
                    <input
                      type="text"
                      id="defaultOutputDirectory"
                      value={settings.files.defaultOutputDirectory}
                      onChange={(e) => updateFileSettings({
                        defaultOutputDirectory: e.target.value
                      })}
                      placeholder="Leave empty for Downloads folder"
                    />
                    <small>Default location for saved files</small>
                  </div>

                  <div className="setting-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.files.autoCleanupTempFiles}
                        onChange={(e) => updateFileSettings({
                          autoCleanupTempFiles: e.target.checked
                        })}
                      />
                      Auto-cleanup Temporary Files
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-actions">
              <div className="settings-actions-left">
                <button onClick={handleExport} disabled={saving}>
                  Export Settings
                </button>
                <label className="import-button">
                  Import Settings
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              
              <div className="settings-actions-right">
                <button onClick={handleReset} disabled={saving} className="reset-button">
                  Reset to Defaults
                </button>
                <button onClick={handleClose} disabled={saving}>
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="save-button"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;