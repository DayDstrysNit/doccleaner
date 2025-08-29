import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  processFile: (filePath: string) =>
    ipcRenderer.invoke('file:process', filePath),

  // Event listeners
  onProcessingProgress: (callback: (progress: unknown) => void) =>
    ipcRenderer.on('processing:progress', callback),
  onProcessingComplete: (callback: (result: unknown) => void) =>
    ipcRenderer.on('processing:complete', callback),
  onProcessingError: (callback: (error: unknown) => void) =>
    ipcRenderer.on('processing:error', callback),
});
