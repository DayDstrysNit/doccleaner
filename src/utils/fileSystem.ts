// File system utilities for secure file operations and temporary file management

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { 
  FileAccessError, 
  FileNotFoundError, 
  FilePermissionError, 
  ValidationError,
  SystemError 
} from '../models/errors';

// File validation configuration
export interface FileValidationConfig {
  maxFileSize: number; // in bytes
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  scanForMalware?: boolean;
}

// Default validation config for DOCX files
export const DEFAULT_VALIDATION_CONFIG: FileValidationConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedExtensions: ['.docx', '.doc'],
  allowedMimeTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
};

// File metadata interface
export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  mimeType?: string;
  isReadable: boolean;
  isWritable: boolean;
}

// Temporary file info
export interface TempFileInfo {
  path: string;
  cleanup: () => Promise<void>;
}

// File operation result
export interface FileOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: FileMetadata;
}

// Global tracking for temporary files and directories
const tempFiles = new Set<string>();
const tempDirs = new Set<string>();

/**
 * Secure file system utilities class
 */
export class FileSystemUtils {

  /**
   * Validate file before processing
   */
  static async validateFile(
    filePath: string, 
    config: FileValidationConfig = DEFAULT_VALIDATION_CONFIG
  ): Promise<FileOperationResult<FileMetadata>> {
    try {
      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new FileNotFoundError(filePath);
      }

      // Get file metadata
      const metadata = await this.getFileMetadata(filePath);
      
      // Validate file size
      if (metadata.size > config.maxFileSize) {
        throw new ValidationError(
          `File size ${metadata.size} exceeds maximum allowed size ${config.maxFileSize}`,
          'fileSize',
          metadata.size
        );
      }

      // Validate file extension
      if (!config.allowedExtensions.includes(metadata.extension.toLowerCase())) {
        throw new ValidationError(
          `File extension ${metadata.extension} is not allowed`,
          'extension',
          metadata.extension
        );
      }

      // Check file permissions
      if (!metadata.isReadable) {
        throw new FilePermissionError(filePath, 'read');
      }

      return {
        success: true,
        data: metadata,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Securely read file with validation
   */
  static async readFile(
    filePath: string,
    config?: FileValidationConfig
  ): Promise<FileOperationResult<Buffer>> {
    try {
      // Validate file first
      const validation = await this.validateFile(filePath, config);
      if (!validation.success) {
        throw validation.error;
      }

      // Read file content
      const content = await fs.readFile(filePath);
      
      return {
        success: true,
        data: content,
        metadata: validation.metadata
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new FileAccessError(
          `Failed to read file: ${error.message}`,
          filePath,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Securely write file with directory creation
   */
  static async writeFile(
    filePath: string,
    content: Buffer | string,
    options: { encoding?: BufferEncoding; mode?: number } = {}
  ): Promise<FileOperationResult<void>> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.ensureDirectory(dir);

      // Check write permissions for directory
      try {
        await fs.access(dir, fsSync.constants.W_OK);
      } catch {
        throw new FilePermissionError(filePath, 'write');
      }

      // Write file
      await fs.writeFile(filePath, content, options);

      return {
        success: true,
        metadata: await this.getFileMetadata(filePath)
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Create temporary file with automatic cleanup
   */
  static async createTempFile(
    prefix: string = 'docx-converter-',
    extension: string = '.tmp'
  ): Promise<TempFileInfo> {
    try {
      const tempDir = os.tmpdir();
      const randomId = crypto.randomBytes(16).toString('hex');
      const fileName = `${prefix}${randomId}${extension}`;
      const tempPath = path.join(tempDir, fileName);

      // Create empty temp file
      await fs.writeFile(tempPath, '');
      
      // Track temp file for cleanup
      tempFiles.add(tempPath);

      const cleanup = async () => {
        try {
          if (await this.fileExists(tempPath)) {
            await fs.unlink(tempPath);
          }
          tempFiles.delete(tempPath);
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${tempPath}:`, error);
        }
      };

      return {
        path: tempPath,
        cleanup
      };

    } catch (error) {
      throw new SystemError(
        `Failed to create temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create temporary directory with automatic cleanup
   */
  static async createTempDirectory(prefix: string = 'docx-converter-'): Promise<TempFileInfo> {
    try {
      const tempDir = os.tmpdir();
      const randomId = crypto.randomBytes(16).toString('hex');
      const dirName = `${prefix}${randomId}`;
      const tempPath = path.join(tempDir, dirName);

      // Create temp directory
      await fs.mkdir(tempPath, { recursive: true });
      
      // Track temp directory for cleanup
      tempDirs.add(tempPath);

      const cleanup = async () => {
        try {
          if (await this.directoryExists(tempPath)) {
            await fs.rm(tempPath, { recursive: true, force: true });
          }
          tempDirs.delete(tempPath);
        } catch (error) {
          console.warn(`Failed to cleanup temp directory ${tempPath}:`, error);
        }
      };

      return {
        path: tempPath,
        cleanup
      };

    } catch (error) {
      throw new SystemError(
        `Failed to create temporary directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cleanup all temporary files and directories
   */
  static async cleanupAllTemp(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Cleanup temp files
    for (const tempFile of tempFiles) {
      cleanupPromises.push(
        fs.unlink(tempFile).catch(error => 
          console.warn(`Failed to cleanup temp file ${tempFile}:`, error)
        )
      );
    }

    // Cleanup temp directories
    for (const tempDir of tempDirs) {
      cleanupPromises.push(
        fs.rm(tempDir, { recursive: true, force: true }).catch(error =>
          console.warn(`Failed to cleanup temp directory ${tempDir}:`, error)
        )
      );
    }

    await Promise.all(cleanupPromises);
    
    tempFiles.clear();
    tempDirs.clear();
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const parsedPath = path.parse(filePath);

      // Check permissions
      let isReadable = false;
      let isWritable = false;

      try {
        await fs.access(filePath, fsSync.constants.R_OK);
        isReadable = true;
      } catch {
        // File is not readable
      }

      try {
        await fs.access(filePath, fsSync.constants.W_OK);
        isWritable = true;
      } catch {
        // File is not writable
      }

      return {
        path: filePath,
        name: parsedPath.name,
        extension: parsedPath.ext,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isReadable,
        isWritable
      };

    } catch (error) {
      throw new FileAccessError(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fsSync.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileAccessError(
        `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Copy file securely
   */
  static async copyFile(
    sourcePath: string,
    destinationPath: string,
    overwrite: boolean = false
  ): Promise<FileOperationResult<void>> {
    try {
      // Validate source file
      const validation = await this.validateFile(sourcePath);
      if (!validation.success) {
        throw validation.error;
      }

      // Check if destination exists
      if (!overwrite && await this.fileExists(destinationPath)) {
        throw new FileAccessError(
          'Destination file already exists and overwrite is disabled',
          destinationPath
        );
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destinationPath);
      await this.ensureDirectory(destDir);

      // Copy file
      await fs.copyFile(sourcePath, destinationPath);

      return {
        success: true,
        metadata: await this.getFileMetadata(destinationPath)
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Move file securely
   */
  static async moveFile(
    sourcePath: string,
    destinationPath: string,
    overwrite: boolean = false
  ): Promise<FileOperationResult<void>> {
    try {
      // First copy the file
      const copyResult = await this.copyFile(sourcePath, destinationPath, overwrite);
      if (!copyResult.success) {
        return copyResult;
      }

      // Then delete the source
      await fs.unlink(sourcePath);

      return {
        success: true,
        metadata: copyResult.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Delete file securely
   */
  static async deleteFile(filePath: string): Promise<FileOperationResult<void>> {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new FileNotFoundError(filePath);
      }

      await fs.unlink(filePath);

      return {
        success: true
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Get available disk space for a path
   */
  static async getAvailableSpace(dirPath: string): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real application, you might want to use a library like 'statvfs' for more accurate results
      const stats = await fs.stat(dirPath);
      return stats.size; // This is not accurate, but serves as a placeholder
    } catch (error) {
      throw new SystemError(
        `Failed to get available disk space: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sanitize file path to prevent directory traversal attacks
   */
  static sanitizePath(filePath: string, baseDir?: string): string {
    if (baseDir) {
      // Check for directory traversal before normalization
      const resolvedPath = path.resolve(baseDir, filePath);
      const resolvedBase = path.resolve(baseDir);
      
      if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
        throw new ValidationError(
          'Path traversal attempt detected',
          'filePath',
          filePath
        );
      }
      
      return resolvedPath;
    }
    
    // Normalize path and remove any path traversal attempts
    let sanitized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    // Convert backslashes to forward slashes and remove double slashes
    sanitized = sanitized.replace(/\\/g, '/').replace(/\/+/g, '/');
    
    return sanitized;
  }
}

// Export utility functions for convenience
export const {
  validateFile,
  readFile,
  writeFile,
  createTempFile,
  createTempDirectory,
  cleanupAllTemp,
  getFileMetadata,
  fileExists,
  directoryExists,
  ensureDirectory,
  copyFile,
  moveFile,
  deleteFile,
  sanitizePath
} = FileSystemUtils;