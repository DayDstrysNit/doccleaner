// Unit tests for file system utilities

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  FileSystemUtils,
  FileValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
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
} from '../utils/fileSystem';
import {
  FileAccessError,
  FileNotFoundError,
  FilePermissionError,
  ValidationError,
  SystemError
} from '../models/errors';

describe('FileSystemUtils', () => {
  let testDir: string;
  let testFile: string;
  let testContent: string;

  beforeAll(async () => {
    // Create a test directory
    testDir = path.join(os.tmpdir(), 'fileSystem-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a test file
    testFile = path.join(testDir, 'test.docx');
    testContent = 'Test document content';
    await fs.writeFile(testFile, testContent);
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
    
    // Cleanup any remaining temp files
    await cleanupAllTemp();
  });

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should validate a valid DOCX file', async () => {
      const result = await validateFile(testFile);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('test');
      expect(result.data?.extension).toBe('.docx');
      expect(result.error).toBeUndefined();
    });

    it('should reject non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.docx');
      const result = await validateFile(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileNotFoundError);
    });

    it('should reject file with invalid extension', async () => {
      const invalidFile = path.join(testDir, 'test.txt');
      await fs.writeFile(invalidFile, 'test content');
      
      const result = await validateFile(invalidFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect((result.error as ValidationError).field).toBe('extension');
      
      // Cleanup
      await fs.unlink(invalidFile);
    });

    it('should reject file exceeding size limit', async () => {
      const largeFile = path.join(testDir, 'large.docx');
      const largeContent = 'x'.repeat(1000);
      await fs.writeFile(largeFile, largeContent);
      
      const config: FileValidationConfig = {
        ...DEFAULT_VALIDATION_CONFIG,
        maxFileSize: 500 // 500 bytes limit
      };
      
      const result = await validateFile(largeFile, config);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect((result.error as ValidationError).field).toBe('fileSize');
      
      // Cleanup
      await fs.unlink(largeFile);
    });

    it('should use custom validation config', async () => {
      const customConfig: FileValidationConfig = {
        maxFileSize: 1024,
        allowedExtensions: ['.txt'],
        allowedMimeTypes: ['text/plain']
      };
      
      const result = await validateFile(testFile, customConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
    });
  });

  describe('readFile', () => {
    it('should read file successfully', async () => {
      const result = await readFile(testFile);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data?.toString()).toBe(testContent);
      expect(result.metadata).toBeDefined();
    });

    it('should throw FileAccessError for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.docx');
      
      await expect(readFile(nonExistentFile)).rejects.toThrow(FileAccessError);
    });

    it('should validate file before reading', async () => {
      const invalidFile = path.join(testDir, 'invalid.txt');
      await fs.writeFile(invalidFile, 'test');
      
      await expect(readFile(invalidFile)).rejects.toThrow(FileAccessError);
      
      // Cleanup
      await fs.unlink(invalidFile);
    });
  });

  describe('writeFile', () => {
    it('should write file successfully', async () => {
      const outputFile = path.join(testDir, 'output.txt');
      const content = 'Test output content';
      
      const result = await writeFile(outputFile, content);
      
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      
      // Verify file was written
      const writtenContent = await fs.readFile(outputFile, 'utf-8');
      expect(writtenContent).toBe(content);
      
      // Cleanup
      await fs.unlink(outputFile);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'newdir');
      const outputFile = path.join(newDir, 'output.txt');
      const content = 'Test content';
      
      const result = await writeFile(outputFile, content);
      
      expect(result.success).toBe(true);
      expect(await directoryExists(newDir)).toBe(true);
      
      // Cleanup
      await fs.rm(newDir, { recursive: true });
    });

    it('should handle write errors gracefully', async () => {
      // Try to write to a read-only location (this might not work on all systems)
      const readOnlyFile = '/root/readonly.txt'; // This should fail on most systems
      
      const result = await writeFile(readOnlyFile, 'content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createTempFile', () => {
    it('should create temporary file with cleanup', async () => {
      const tempInfo = await createTempFile('test-', '.tmp');
      
      expect(tempInfo.path).toBeDefined();
      expect(tempInfo.cleanup).toBeInstanceOf(Function);
      expect(await fileExists(tempInfo.path)).toBe(true);
      
      // Test cleanup
      await tempInfo.cleanup();
      expect(await fileExists(tempInfo.path)).toBe(false);
    });

    it('should create temp file with custom prefix and extension', async () => {
      const tempInfo = await createTempFile('custom-prefix-', '.docx');
      
      expect(path.basename(tempInfo.path)).toMatch(/^custom-prefix-.*\.docx$/);
      expect(await fileExists(tempInfo.path)).toBe(true);
      
      await tempInfo.cleanup();
    });

    it('should track temp files for global cleanup', async () => {
      const tempInfo1 = await createTempFile();
      const tempInfo2 = await createTempFile();
      
      expect(await fileExists(tempInfo1.path)).toBe(true);
      expect(await fileExists(tempInfo2.path)).toBe(true);
      
      // Global cleanup should remove all temp files
      await cleanupAllTemp();
      
      expect(await fileExists(tempInfo1.path)).toBe(false);
      expect(await fileExists(tempInfo2.path)).toBe(false);
    });
  });

  describe('createTempDirectory', () => {
    it('should create temporary directory with cleanup', async () => {
      const tempInfo = await createTempDirectory('test-dir-');
      
      expect(tempInfo.path).toBeDefined();
      expect(tempInfo.cleanup).toBeInstanceOf(Function);
      expect(await directoryExists(tempInfo.path)).toBe(true);
      
      // Test cleanup
      await tempInfo.cleanup();
      expect(await directoryExists(tempInfo.path)).toBe(false);
    });

    it('should create temp directory with custom prefix', async () => {
      const tempInfo = await createTempDirectory('custom-dir-');
      
      expect(path.basename(tempInfo.path)).toMatch(/^custom-dir-/);
      expect(await directoryExists(tempInfo.path)).toBe(true);
      
      await tempInfo.cleanup();
    });
  });

  describe('getFileMetadata', () => {
    it('should return complete file metadata', async () => {
      const metadata = await getFileMetadata(testFile);
      
      expect(metadata.path).toBe(testFile);
      expect(metadata.name).toBe('test');
      expect(metadata.extension).toBe('.docx');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.modifiedAt).toBeInstanceOf(Date);
      expect(typeof metadata.isReadable).toBe('boolean');
      expect(typeof metadata.isWritable).toBe('boolean');
    });

    it('should throw FileAccessError for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.docx');
      
      await expect(getFileMetadata(nonExistentFile)).rejects.toThrow(FileAccessError);
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      expect(await fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.docx');
      expect(await fileExists(nonExistentFile)).toBe(false);
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directory', async () => {
      expect(await directoryExists(testDir)).toBe(true);
    });

    it('should return false for non-existent directory', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');
      expect(await directoryExists(nonExistentDir)).toBe(false);
    });

    it('should return false for file path', async () => {
      expect(await directoryExists(testFile)).toBe(false);
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'ensure-test');
      
      expect(await directoryExists(newDir)).toBe(false);
      
      await ensureDirectory(newDir);
      
      expect(await directoryExists(newDir)).toBe(true);
      
      // Cleanup
      await fs.rmdir(newDir);
    });

    it('should not fail if directory already exists', async () => {
      await expect(ensureDirectory(testDir)).resolves.not.toThrow();
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');
      
      await ensureDirectory(nestedDir);
      
      expect(await directoryExists(nestedDir)).toBe(true);
      
      // Cleanup
      await fs.rm(path.join(testDir, 'level1'), { recursive: true });
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      const destFile = path.join(testDir, 'copied.docx');
      
      const result = await copyFile(testFile, destFile);
      
      expect(result.success).toBe(true);
      expect(await fileExists(destFile)).toBe(true);
      
      // Verify content is the same
      const originalContent = await fs.readFile(testFile);
      const copiedContent = await fs.readFile(destFile);
      expect(Buffer.compare(originalContent, copiedContent)).toBe(0);
      
      // Cleanup
      await fs.unlink(destFile);
    });

    it('should fail if destination exists and overwrite is false', async () => {
      const destFile = path.join(testDir, 'existing.docx');
      await fs.writeFile(destFile, 'existing content');
      
      const result = await copyFile(testFile, destFile, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileAccessError);
      
      // Cleanup
      await fs.unlink(destFile);
    });

    it('should overwrite if overwrite is true', async () => {
      const destFile = path.join(testDir, 'overwrite.docx');
      await fs.writeFile(destFile, 'old content');
      
      const result = await copyFile(testFile, destFile, true);
      
      expect(result.success).toBe(true);
      
      // Verify content was overwritten
      const newContent = await fs.readFile(destFile, 'utf-8');
      expect(newContent).toBe(testContent);
      
      // Cleanup
      await fs.unlink(destFile);
    });
  });

  describe('moveFile', () => {
    it('should move file successfully', async () => {
      const sourceFile = path.join(testDir, 'source.docx');
      const destFile = path.join(testDir, 'moved.docx');
      const content = 'content to move';
      
      await fs.writeFile(sourceFile, content);
      
      const result = await moveFile(sourceFile, destFile);
      
      if (!result.success) {
        console.error('Move failed:', result.error);
      }
      
      expect(result.success).toBe(true);
      expect(await fileExists(sourceFile)).toBe(false);
      expect(await fileExists(destFile)).toBe(true);
      
      const movedContent = await fs.readFile(destFile, 'utf-8');
      expect(movedContent).toBe(content);
      
      // Cleanup
      await fs.unlink(destFile);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileToDelete = path.join(testDir, 'delete-me.txt');
      await fs.writeFile(fileToDelete, 'delete this');
      
      expect(await fileExists(fileToDelete)).toBe(true);
      
      const result = await deleteFile(fileToDelete);
      
      expect(result.success).toBe(true);
      expect(await fileExists(fileToDelete)).toBe(false);
    });

    it('should fail for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      
      const result = await deleteFile(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileNotFoundError);
    });
  });

  describe('sanitizePath', () => {
    it('should remove path traversal attempts', () => {
      const maliciousPath = '../../../etc/passwd';
      const sanitized = sanitizePath(maliciousPath);
      
      expect(sanitized).not.toContain('..');
      expect(sanitized).toBe('etc/passwd');
    });

    it('should normalize path separators', () => {
      const messyPath = 'folder//subfolder\\\\file.txt';
      const sanitized = sanitizePath(messyPath);
      
      expect(sanitized).toBe('folder/subfolder/file.txt');
    });

    it('should enforce base directory restriction', () => {
      const baseDir = testDir; // Use actual test directory
      // Create a path that would escape the base directory
      const maliciousPath = path.join('..', '..', '..', 'etc', 'passwd');
      
      expect(() => sanitizePath(maliciousPath, baseDir)).toThrow(ValidationError);
    });

    it('should allow valid paths within base directory', () => {
      const baseDir = testDir;
      const validPath = 'subfolder/file.txt';
      
      const sanitized = sanitizePath(validPath, baseDir);
      
      expect(sanitized).toContain(baseDir);
      expect(sanitized).toContain('subfolder/file.txt');
    });
  });

  describe('cleanupAllTemp', () => {
    it('should cleanup all temporary files and directories', async () => {
      const tempFile1 = await createTempFile();
      const tempFile2 = await createTempFile();
      const tempDir1 = await createTempDirectory();
      const tempDir2 = await createTempDirectory();
      
      // Verify they exist
      expect(await fileExists(tempFile1.path)).toBe(true);
      expect(await fileExists(tempFile2.path)).toBe(true);
      expect(await directoryExists(tempDir1.path)).toBe(true);
      expect(await directoryExists(tempDir2.path)).toBe(true);
      
      // Cleanup all
      await cleanupAllTemp();
      
      // Verify they're gone
      expect(await fileExists(tempFile1.path)).toBe(false);
      expect(await fileExists(tempFile2.path)).toBe(false);
      expect(await directoryExists(tempDir1.path)).toBe(false);
      expect(await directoryExists(tempDir2.path)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test might not work on all systems, but demonstrates the concept
      const restrictedPath = '/root/restricted.txt';
      
      const result = await writeFile(restrictedPath, 'content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await readFile('/nonexistent/path/file.docx');
      } catch (error) {
        expect(error).toBeInstanceOf(FileAccessError);
        expect((error as FileAccessError).message).toContain('Failed to read file');
        expect((error as FileAccessError).filePath).toBe('/nonexistent/path/file.docx');
      }
    });
  });
});

// Integration tests for file system operations
describe('FileSystemUtils Integration', () => {
  let integrationTestDir: string;

  beforeAll(async () => {
    integrationTestDir = path.join(os.tmpdir(), 'fs-integration-test-' + Date.now());
    await fs.mkdir(integrationTestDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(integrationTestDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup integration test directory:', error);
    }
    await cleanupAllTemp();
  });

  it('should handle complete file processing workflow', async () => {
    // Create source file
    const sourceFile = path.join(integrationTestDir, 'source.docx');
    const originalContent = 'Original document content';
    await fs.writeFile(sourceFile, originalContent);

    // Validate file
    const validation = await validateFile(sourceFile);
    expect(validation.success).toBe(true);

    // Read file
    const readResult = await readFile(sourceFile);
    expect(readResult.success).toBe(true);
    expect(readResult.data?.toString()).toBe(originalContent);

    // Create temp file for processing
    const tempFile = await createTempFile('processing-', '.docx');
    
    // Write processed content to temp file
    const processedContent = 'Processed content';
    const writeResult = await writeFile(tempFile.path, processedContent);
    expect(writeResult.success).toBe(true);

    // Copy temp file to final destination
    const finalFile = path.join(integrationTestDir, 'final.docx');
    const copyResult = await copyFile(tempFile.path, finalFile);
    expect(copyResult.success).toBe(true);

    // Verify final file
    const finalContent = await fs.readFile(finalFile, 'utf-8');
    expect(finalContent).toBe(processedContent);

    // Cleanup temp file
    await tempFile.cleanup();
    expect(await fileExists(tempFile.path)).toBe(false);

    // Final file should still exist
    expect(await fileExists(finalFile)).toBe(true);
  });

  it('should handle batch file operations', async () => {
    const batchDir = path.join(integrationTestDir, 'batch');
    await ensureDirectory(batchDir);

    // Create multiple test files
    const files = [];
    for (let i = 0; i < 5; i++) {
      const filePath = path.join(batchDir, `file${i}.docx`);
      await fs.writeFile(filePath, `Content ${i}`);
      files.push(filePath);
    }

    // Process all files
    const results = [];
    for (const file of files) {
      const validation = await validateFile(file);
      expect(validation.success).toBe(true);
      
      const readResult = await readFile(file);
      expect(readResult.success).toBe(true);
      
      results.push(readResult);
    }

    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.data?.toString()).toBe(`Content ${index}`);
    });
  });

  it('should handle error recovery in batch operations', async () => {
    const errorTestDir = path.join(integrationTestDir, 'error-test');
    await ensureDirectory(errorTestDir);

    // Create mix of valid and invalid files
    const validFile = path.join(errorTestDir, 'valid.docx');
    const invalidFile = path.join(errorTestDir, 'invalid.txt');
    const nonExistentFile = path.join(errorTestDir, 'nonexistent.docx');

    await fs.writeFile(validFile, 'Valid content');
    await fs.writeFile(invalidFile, 'Invalid content');

    // Process files with error handling
    const files = [validFile, invalidFile, nonExistentFile];
    const results = [];

    for (const file of files) {
      try {
        const result = await readFile(file);
        results.push({ file, success: true, result });
      } catch (error) {
        results.push({ file, success: false, error });
      }
    }

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true); // valid file
    expect(results[1].success).toBe(false); // invalid extension
    expect(results[2].success).toBe(false); // non-existent file
  });
});