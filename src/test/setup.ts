import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global test setup
// Mock electron APIs for testing
global.electronAPI = {
  selectFiles: vi.fn(),
  processFile: vi.fn(),
  onProcessingProgress: vi.fn(),
  onProcessingComplete: vi.fn(),
  onProcessingError: vi.fn(),
};
