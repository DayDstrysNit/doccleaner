// Data model validation utilities

import {
  DocumentModel,
  DocumentMetadata,
  ContentElement,
  StructuredContent,
  ProcessingOptions,
  ValidationError
} from '../models';

/**
 * Validate DocumentMetadata
 */
export function validateDocumentMetadata(metadata: DocumentMetadata): void {
  if (!metadata.filename || typeof metadata.filename !== 'string') {
    throw new ValidationError('Filename is required and must be a string', 'filename', metadata.filename);
  }

  if (!metadata.fileSize || typeof metadata.fileSize !== 'number' || metadata.fileSize <= 0) {
    throw new ValidationError('File size must be a positive number', 'fileSize', metadata.fileSize);
  }

  if (!metadata.createdDate || !(metadata.createdDate instanceof Date)) {
    throw new ValidationError('Created date must be a valid Date object', 'createdDate', metadata.createdDate);
  }

  if (!metadata.modifiedDate || !(metadata.modifiedDate instanceof Date)) {
    throw new ValidationError('Modified date must be a valid Date object', 'modifiedDate', metadata.modifiedDate);
  }

  if (metadata.modifiedDate < metadata.createdDate) {
    throw new ValidationError('Modified date cannot be before created date', 'modifiedDate', metadata.modifiedDate);
  }
}

/**
 * Validate ContentElement
 */
export function validateContentElement(element: ContentElement): void {
  const validTypes = ['heading', 'paragraph', 'list', 'table', 'image'];
  
  if (!element.type || !validTypes.includes(element.type)) {
    throw new ValidationError(`Content type must be one of: ${validTypes.join(', ')}`, 'type', element.type);
  }

  if (typeof element.content !== 'string') {
    throw new ValidationError('Content must be a string', 'content', element.content);
  }

  if (element.type === 'heading' && element.level) {
    if (typeof element.level !== 'number' || element.level < 1 || element.level > 6) {
      throw new ValidationError('Heading level must be a number between 1 and 6', 'level', element.level);
    }
  }

  // Recursively validate children
  if (element.children) {
    if (!Array.isArray(element.children)) {
      throw new ValidationError('Children must be an array', 'children', element.children);
    }
    element.children.forEach((child, index) => {
      try {
        validateContentElement(child);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `Child element at index ${index}: ${error.message}`,
            `children[${index}].${error.field}`,
            error.value
          );
        }
        throw error;
      }
    });
  }
}

/**
 * Validate DocumentModel
 */
export function validateDocumentModel(document: DocumentModel): void {
  if (!document.metadata) {
    throw new ValidationError('Document metadata is required', 'metadata', document.metadata);
  }
  validateDocumentMetadata(document.metadata);

  if (!Array.isArray(document.content)) {
    throw new ValidationError('Document content must be an array', 'content', document.content);
  }

  document.content.forEach((element, index) => {
    try {
      validateContentElement(element);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Content element at index ${index}: ${error.message}`,
          `content[${index}].${error.field}`,
          error.value
        );
      }
      throw error;
    }
  });

  if (!Array.isArray(document.styles)) {
    throw new ValidationError('Document styles must be an array', 'styles', document.styles);
  }

  if (!Array.isArray(document.images)) {
    throw new ValidationError('Document images must be an array', 'images', document.images);
  }
}

/**
 * Validate ProcessingOptions
 */
export function validateProcessingOptions(options: ProcessingOptions): void {
  const validOutputFormats = ['html', 'markdown', 'plaintext'];
  if (!validOutputFormats.includes(options.outputFormat)) {
    throw new ValidationError(
      `Output format must be one of: ${validOutputFormats.join(', ')}`,
      'outputFormat',
      options.outputFormat
    );
  }

  if (typeof options.preserveImages !== 'boolean') {
    throw new ValidationError('preserveImages must be a boolean', 'preserveImages', options.preserveImages);
  }

  if (typeof options.includeMetadata !== 'boolean') {
    throw new ValidationError('includeMetadata must be a boolean', 'includeMetadata', options.includeMetadata);
  }

  const validCleanupLevels = ['minimal', 'standard', 'aggressive'];
  if (!validCleanupLevels.includes(options.cleanupLevel)) {
    throw new ValidationError(
      `Cleanup level must be one of: ${validCleanupLevels.join(', ')}`,
      'cleanupLevel',
      options.cleanupLevel
    );
  }

  if (typeof options.customSettings !== 'object' || options.customSettings === null) {
    throw new ValidationError('customSettings must be an object', 'customSettings', options.customSettings);
  }
}

/**
 * Validate StructuredContent
 */
export function validateStructuredContent(content: StructuredContent): void {
  if (content.title !== undefined && typeof content.title !== 'string') {
    throw new ValidationError('Title must be a string if provided', 'title', content.title);
  }

  if (!Array.isArray(content.sections)) {
    throw new ValidationError('Sections must be an array', 'sections', content.sections);
  }

  content.sections.forEach((section, index) => {
    try {
      validateContentElement(section);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Section at index ${index}: ${error.message}`,
          `sections[${index}].${error.field}`,
          error.value
        );
      }
      throw error;
    }
  });

  if (!content.metadata) {
    throw new ValidationError('Processing metadata is required', 'metadata', content.metadata);
  }

  // Validate processing metadata
  const metadata = content.metadata;
  if (!(metadata.processedAt instanceof Date)) {
    throw new ValidationError('processedAt must be a Date object', 'metadata.processedAt', metadata.processedAt);
  }

  if (typeof metadata.processingTime !== 'number' || metadata.processingTime < 0) {
    throw new ValidationError('processingTime must be a non-negative number', 'metadata.processingTime', metadata.processingTime);
  }

  if (typeof metadata.originalFormat !== 'string') {
    throw new ValidationError('originalFormat must be a string', 'metadata.originalFormat', metadata.originalFormat);
  }

  if (!Array.isArray(metadata.warnings)) {
    throw new ValidationError('warnings must be an array', 'metadata.warnings', metadata.warnings);
  }

  if (!Array.isArray(metadata.errors)) {
    throw new ValidationError('errors must be an array', 'metadata.errors', metadata.errors);
  }
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string, supportedExtensions: string[]): void {
  const extension = filename.toLowerCase().split('.').pop();
  if (!extension || !supportedExtensions.includes(extension)) {
    throw new ValidationError(
      `File extension must be one of: ${supportedExtensions.join(', ')}`,
      'filename',
      filename
    );
  }
}

/**
 * Validate file size limits
 */
export function validateFileSize(fileSize: number, maxSizeBytes: number): void {
  if (fileSize > maxSizeBytes) {
    throw new ValidationError(
      `File size (${fileSize} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes)`,
      'fileSize',
      fileSize
    );
  }
}