// Unit tests for validation utilities

import { describe, it, expect } from 'vitest';
import {
  validateDocumentMetadata,
  validateContentElement,
  validateDocumentModel,
  validateProcessingOptions,
  validateStructuredContent,
  validateFileExtension,
  validateFileSize
} from '../utils/validation';
import {
  DocumentMetadata,
  ContentElement,
  DocumentModel,
  ProcessingOptions,
  StructuredContent,
  ProcessingMetadata,
  ValidationError
} from '../models';

describe('validateDocumentMetadata', () => {
  it('should pass for valid metadata', () => {
    const validMetadata: DocumentMetadata = {
      filename: 'test.docx',
      fileSize: 1024,
      createdDate: new Date('2023-01-01'),
      modifiedDate: new Date('2023-01-02')
    };

    expect(() => validateDocumentMetadata(validMetadata)).not.toThrow();
  });

  it('should throw for invalid filename', () => {
    const invalidMetadata = {
      filename: '',
      fileSize: 1024,
      createdDate: new Date(),
      modifiedDate: new Date()
    } as DocumentMetadata;

    expect(() => validateDocumentMetadata(invalidMetadata)).toThrow(ValidationError);
  });

  it('should throw for negative file size', () => {
    const invalidMetadata: DocumentMetadata = {
      filename: 'test.docx',
      fileSize: -1,
      createdDate: new Date(),
      modifiedDate: new Date()
    };

    expect(() => validateDocumentMetadata(invalidMetadata)).toThrow(ValidationError);
  });

  it('should throw when modified date is before created date', () => {
    const invalidMetadata: DocumentMetadata = {
      filename: 'test.docx',
      fileSize: 1024,
      createdDate: new Date('2023-01-02'),
      modifiedDate: new Date('2023-01-01')
    };

    expect(() => validateDocumentMetadata(invalidMetadata)).toThrow(ValidationError);
  });
});

describe('validateContentElement', () => {
  it('should pass for valid content element', () => {
    const validElement: ContentElement = {
      type: 'paragraph',
      content: 'Test content'
    };

    expect(() => validateContentElement(validElement)).not.toThrow();
  });

  it('should pass for valid heading with level', () => {
    const validHeading: ContentElement = {
      type: 'heading',
      content: 'Test Heading',
      level: 2
    };

    expect(() => validateContentElement(validHeading)).not.toThrow();
  });

  it('should throw for invalid content type', () => {
    const invalidElement = {
      type: 'invalid',
      content: 'Test content'
    } as ContentElement;

    expect(() => validateContentElement(invalidElement)).toThrow(ValidationError);
  });

  it('should throw for invalid heading level', () => {
    const invalidHeading: ContentElement = {
      type: 'heading',
      content: 'Test Heading',
      level: 7
    };

    expect(() => validateContentElement(invalidHeading)).toThrow(ValidationError);
  });

  it('should validate nested children', () => {
    const elementWithChildren: ContentElement = {
      type: 'list',
      content: 'Main list',
      children: [
        {
          type: 'paragraph',
          content: 'Item 1'
        },
        {
          type: 'invalid' as any,
          content: 'Invalid item'
        }
      ]
    };

    expect(() => validateContentElement(elementWithChildren)).toThrow(ValidationError);
  });
});

describe('validateProcessingOptions', () => {
  it('should pass for valid options', () => {
    const validOptions: ProcessingOptions = {
      outputFormat: 'html',
      preserveImages: true,
      includeMetadata: false,
      cleanupLevel: 'standard',
      customSettings: {}
    };

    expect(() => validateProcessingOptions(validOptions)).not.toThrow();
  });

  it('should throw for invalid output format', () => {
    const invalidOptions = {
      outputFormat: 'invalid',
      preserveImages: true,
      includeMetadata: false,
      cleanupLevel: 'standard',
      customSettings: {}
    } as ProcessingOptions;

    expect(() => validateProcessingOptions(invalidOptions)).toThrow(ValidationError);
  });

  it('should throw for invalid cleanup level', () => {
    const invalidOptions = {
      outputFormat: 'html',
      preserveImages: true,
      includeMetadata: false,
      cleanupLevel: 'invalid',
      customSettings: {}
    } as ProcessingOptions;

    expect(() => validateProcessingOptions(invalidOptions)).toThrow(ValidationError);
  });
});

describe('validateStructuredContent', () => {
  it('should pass for valid structured content', () => {
    const metadata: ProcessingMetadata = {
      processedAt: new Date(),
      processingTime: 1000,
      originalFormat: 'docx',
      warnings: [],
      errors: []
    };

    const validContent: StructuredContent = {
      title: 'Test Document',
      sections: [
        {
          type: 'heading',
          level: 1,
          content: 'Introduction'
        }
      ],
      metadata
    };

    expect(() => validateStructuredContent(validContent)).not.toThrow();
  });

  it('should throw for invalid processing metadata', () => {
    const invalidContent: StructuredContent = {
      sections: [],
      metadata: {
        processedAt: 'invalid' as any,
        processingTime: 1000,
        originalFormat: 'docx',
        warnings: [],
        errors: []
      }
    };

    expect(() => validateStructuredContent(invalidContent)).toThrow(ValidationError);
  });
});

describe('validateFileExtension', () => {
  it('should pass for supported extension', () => {
    expect(() => validateFileExtension('test.docx', ['docx', 'doc'])).not.toThrow();
  });

  it('should throw for unsupported extension', () => {
    expect(() => validateFileExtension('test.txt', ['docx', 'doc'])).toThrow(ValidationError);
  });

  it('should be case insensitive', () => {
    expect(() => validateFileExtension('test.DOCX', ['docx', 'doc'])).not.toThrow();
  });
});

describe('validateFileSize', () => {
  it('should pass for file within size limit', () => {
    expect(() => validateFileSize(1024, 2048)).not.toThrow();
  });

  it('should throw for file exceeding size limit', () => {
    expect(() => validateFileSize(2048, 1024)).toThrow(ValidationError);
  });
});