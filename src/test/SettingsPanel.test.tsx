import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../components/SettingsPanel';
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
    resetSettings: vi.fn(),
    exportSettings: vi.fn(),
    importSettings: vi.fn(),
  }
}));

const mockSettingsService = settingsService as any;

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for download functionality
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
};

const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName) => {
  if (tagName === 'a') {
    return mockLink as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock document.body methods
document.body.appendChild = vi.fn();
document.body.removeChild = vi.fn();

describe('SettingsPanel Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSettingsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsService.loadSettings.mockResolvedValue(DEFAULT_APP_SETTINGS);
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<SettingsPanel {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Application Settings')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      expect(screen.getByText('Application Settings')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Interface')).toBeInTheDocument();
      expect(screen.getByText('Files')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    it('should show settings after loading', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Processing Options')).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('should switch between tabs', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Switch to Interface tab
      fireEvent.click(screen.getByText('Interface'));
      expect(screen.getByText('Interface Preferences')).toBeInTheDocument();

      // Switch to Files tab
      fireEvent.click(screen.getByText('Files'));
      expect(screen.getByText('File Handling')).toBeInTheDocument();

      // Switch back to Processing tab
      fireEvent.click(screen.getByText('Processing'));
      expect(screen.getByText('Processing Options')).toBeInTheDocument();
    });

    it('should highlight active tab', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      const processingTab = screen.getByRole('button', { name: 'Processing' });
      const interfaceTab = screen.getByRole('button', { name: 'Interface' });

      expect(processingTab).toHaveClass('active');
      expect(interfaceTab).not.toHaveClass('active');

      fireEvent.click(interfaceTab);

      expect(processingTab).not.toHaveClass('active');
      expect(interfaceTab).toHaveClass('active');
    });
  });

  describe('processing settings', () => {
    it('should display current processing settings', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        processing: {
          ...DEFAULT_APP_SETTINGS.processing,
          defaultOutputFormat: 'html',
          preserveImages: true,
          batchSize: 10
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(testSettings);

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('html')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /preserve images/i })).toBeChecked();
    });

    it('should update processing settings', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Change output format
      const formatSelect = screen.getByLabelText('Default Output Format:');
      await user.selectOptions(formatSelect, 'html');

      // Change batch size
      const batchSizeInput = screen.getByLabelText('Batch Size:');
      await user.clear(batchSizeInput);
      await user.type(batchSizeInput, '15');

      // Toggle preserve images
      const preserveImagesCheckbox = screen.getByRole('checkbox', { name: /preserve images/i });
      await user.click(preserveImagesCheckbox);

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('UI settings', () => {
    it('should display current UI settings', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ui: {
          ...DEFAULT_APP_SETTINGS.ui,
          theme: 'dark',
          showPreviewByDefault: false
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(testSettings);

      render(<SettingsPanel {...defaultProps} />);
      
      // Switch to Interface tab
      await waitFor(() => {
        fireEvent.click(screen.getByText('Interface'));
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
      });

      expect(screen.getByRole('checkbox', { name: /show preview by default/i })).not.toBeChecked();
    });

    it('should update UI settings', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      // Switch to Interface tab
      await waitFor(() => {
        fireEvent.click(screen.getByText('Interface'));
      });

      await waitFor(() => {
        expect(screen.getByText('Interface Preferences')).toBeInTheDocument();
      });

      // Change theme
      const themeSelect = screen.getByLabelText('Theme:');
      await user.selectOptions(themeSelect, 'dark');

      // Toggle show preview by default
      const showPreviewCheckbox = screen.getByRole('checkbox', { name: /show preview by default/i });
      await user.click(showPreviewCheckbox);

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('file settings', () => {
    it('should display current file settings', async () => {
      const testSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        files: {
          ...DEFAULT_APP_SETTINGS.files,
          maxFileSize: 200 * 1024 * 1024, // 200MB
          allowedExtensions: ['.docx', '.doc', '.rtf']
        }
      };

      mockSettingsService.loadSettings.mockResolvedValue(testSettings);

      render(<SettingsPanel {...defaultProps} />);
      
      // Switch to Files tab
      await waitFor(() => {
        fireEvent.click(screen.getByText('Files'));
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('200')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('.docx, .doc, .rtf')).toBeInTheDocument();
    });

    it('should update file settings', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      // Switch to Files tab
      await waitFor(() => {
        fireEvent.click(screen.getByText('Files'));
      });

      await waitFor(() => {
        expect(screen.getByText('File Handling')).toBeInTheDocument();
      });

      // Change max file size
      const maxFileSizeInput = screen.getByLabelText('Max File Size (MB):');
      await user.clear(maxFileSizeInput);
      await user.type(maxFileSizeInput, '150');

      // Change allowed extensions
      const extensionsInput = screen.getByLabelText('Allowed Extensions:');
      await user.clear(extensionsInput);
      await user.type(extensionsInput, '.docx, .doc, .rtf, .odt');

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('actions', () => {
    it('should save settings', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Make a change
      const formatSelect = screen.getByLabelText('Default Output Format:');
      await user.selectOptions(formatSelect, 'html');

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockSettingsService.saveSettings).toHaveBeenCalled();
    });

    it('should reset settings', async () => {
      const user = userEvent.setup();
      
      // Mock window.confirm
      window.confirm = vi.fn(() => true);

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to reset all settings to defaults?');
      expect(mockSettingsService.resetSettings).toHaveBeenCalled();
    });

    it('should not reset settings if user cancels', async () => {
      const user = userEvent.setup();
      
      // Mock window.confirm to return false
      window.confirm = vi.fn(() => false);

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
      await user.click(resetButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockSettingsService.resetSettings).not.toHaveBeenCalled();
    });

    it('should export settings', async () => {
      const user = userEvent.setup();
      const exportedJson = JSON.stringify(DEFAULT_APP_SETTINGS);
      mockSettingsService.exportSettings.mockResolvedValue(exportedJson);

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export settings/i });
      await user.click(exportButton);

      expect(mockSettingsService.exportSettings).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should close panel', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SettingsPanel {...defaultProps} onClose={onClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Application Settings')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close settings/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should warn before closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      // Mock window.confirm
      window.confirm = vi.fn(() => false);

      render(<SettingsPanel {...defaultProps} onClose={onClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Make a change to create unsaved changes
      const formatSelect = screen.getByLabelText('Default Output Format:');
      await user.selectOptions(formatSelect, 'html');

      const closeButton = screen.getByRole('button', { name: /close settings/i });
      await user.click(closeButton);

      expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to close?');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should display loading errors', async () => {
      mockSettingsService.loadSettings.mockRejectedValue(new Error('Failed to load'));

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
      });
    });

    it('should display save errors', async () => {
      const user = userEvent.setup();
      mockSettingsService.saveSettings.mockRejectedValue(new Error('Failed to save'));

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      // Make a change
      const formatSelect = screen.getByLabelText('Default Output Format:');
      await user.selectOptions(formatSelect, 'html');

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to save')).toBeInTheDocument();
      });
    });

    it('should dismiss errors', async () => {
      const user = userEvent.setup();
      mockSettingsService.loadSettings.mockRejectedValue(new Error('Failed to load'));

      render(<SettingsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(screen.queryByText('Error: Failed to load')).not.toBeInTheDocument();
    });
  });
});