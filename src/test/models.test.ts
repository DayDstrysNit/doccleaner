// Unit tests for data model validation

import { describe, it, expect } from 'vitest';
import {
  DocumentModel,
  StructuredContent,
  ProcessingOptions,
  ContentElement,
  DocumentMetadata,
  ProcessingMetadata,
  ValidationError,
  FileAccessError,
  ParsingError,
  ProcessingError,
  ErrorCategory,
  RecoveryAction
} from '../models';

describe('DocumentModel', () => {
  it('should create a valid DocumentModel', () => {
    const metadata: DocumentMetadata = {
      filename: 'test.docx',
      fileSize: 1024,
      createdDate: new Date('2023-01-01'),
      modifiedDate: new Date('2023-01-02')
    };

    const content: ContentElement[] = [
      {
        type: 'heading',
        content: 'Test Heading',
        level: 1
      },
      {
        type: 'paragraph',
        content: 'Test paragraph content'
      }
    ];

    const document: DocumentModel = {
      metadata,
      content,
      styles: [],
      images: []
    };

    expect(document.metadata.filename).toBe('test.docx');
    expect(document.content).toHaveLength(2);
    expect(document.content[0].type).toBe('heading');
    expect(document.content[0].level).toBe(1);
  });

  it('should handle nested content elements', () => {
    const listElement: ContentElement = {
      type: 'list',
      content: 'Main list',
      children: [
        {
          type: 'paragraph',
          content: 'List item 1'
        },
        {
          type: 'paragraph',
          content: 'List item 2'
        }
      ]
    };

    expect(listElement.children).toHaveLength(2);
    expect(listElement.children![0].content).toBe('List item 1');
  });
});

describe('StructuredContent', () => {
  it('should create valid StructuredContent', () => {
    const processingMetadata: ProcessingMetadata = {
      processedAt: new Date(),
      processingTime: 1500,
      originalFormat: 'docx',
      warnings: [],
      errors: []
    };

    const structuredContent: StructuredContent = {
      title: 'Test Document',
      sections: [
        {
          type: 'heading',
          level: 1,
          content: 'Introduction'
        },
        {
          type: 'paragraph',
          content: 'This is the introduction paragraph.'
        }
      ],
      metadata: processingMetadata
    };

    expect(structuredContent.title).toBe('Test Document');
    expect(structuredContent.sections).toHaveLength(2);
    expect(structuredContent.metadata.originalFormat).toBe('docx');
  });

  it('should handle sections with children', () => {
    const sectionWithChildren = {
      type: 'heading' as const,
      level: 1,
      content: 'Main Section',
      children: [
        {
          type: 'paragraph' as const,
          content: 'Subsection content'
        }
      ]
    };

    expect(sectionWithChildren.children).toHaveLength(1);
    expect(sectionWithChildren.children![0].type).toBe('paragraph');
  });
});

describe('ProcessingOptions', () => {
  it('should create valid ProcessingOptions with all formats', () => {
    const htmlOptions: ProcessingOptions = {
      outputFormat: 'html',
      preserveImages: true,
      includeMetadata: false,
      cleanupLevel: 'standard',
      customSettings: {}
    };

    const markdownOptions: ProcessingOptions = {
      outputFormat: 'markdown',
      preserveImages: false,
      includeMetadata: true,
      cleanupLevel: 'aggressive',
      customSettings: { customFlag: true }
    };

    const plaintextOptions: ProcessingOptions = {
      outputFormat: 'plaintext',
      preserveImages: false,
      includeMetadata: false,
      cleanupLevel: 'minimal',
      customSettings: {}
    };

    expect(htmlOptions.outputFormat).toBe('html');
    expect(markdownOptions.outputFormat).toBe('markdown');
    expect(plaintextOptions.outputFormat).toBe('plaintext');
    
    expect(htmlOptions.preserveImages).toBe(true);
    expect(markdownOptions.includeMetadata).toBe(true);
    expect(plaintextOptions.cleanupLevel).toBe('minimal');
  });

  it('should handle custom settings', () => {
    const options: ProcessingOptions = {
      outputFormat: 'html',
      preserveImages: true,
      includeMetadata: false,
      cleanupLevel: 'standard',
      customSettings: {
        maxImageWidth: 800,
        stripComments: true,
        preserveLineBreaks: false
      }
    };

    expect(options.customSettings.maxImageWidth).toBe(800);
    expect(options.customSettings.stripComments).toBe(true);
    expect(options.customSettings.preserveLineBreaks).toBe(false);
  });
});

describe('Error Types', () => {
  it('should create FileAccessError with correct properties', () => {
    const error = new FileAccessError('Cannot read file', '/path/to/file.docx');
    
    expect(error.message).toBe('Cannot read file');
    expect(error.filePath).toBe('/path/to/file.docx');
    expect(error.code).toBe('FILE_ACCESS_ERROR');
    expect(error.category).toBe(ErrorCategory.FILE_ACCESS);
    expect(error.name).toBe('FileAccessError');
  });

  it('should create ParsingError with correct properties', () => {
    const error = new ParsingError('Invalid DOCX format', '/path/to/file.docx');
    
    expect(error.message).toBe('Invalid DOCX format');
    expect(error.filePath).toBe('/path/to/file.docx');
    expect(error.code).toBe('PARSING_ERROR');
    expect(error.category).toBe(ErrorCategory.PARSING);
  });

  it('should create ProcessingError with correct properties', () => {
    const error = new ProcessingError('Content processing failed', 'cleanup');
    
    expect(error.message).toBe('Content processing failed');
    expect(error.stage).toBe('cleanup');
    expect(error.code).toBe('PROCESSING_ERROR');
    expect(error.category).toBe(ErrorCategory.PROCESSING);
  });

  it('should create ValidationError with field and value', () => {
    const error = new ValidationError('Invalid file size', 'fileSize', -1);
    
    expect(error.message).toBe('Invalid file size');
    expect(error.field).toBe('fileSize');
    expect(error.value).toBe(-1);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.category).toBe(ErrorCategory.VALIDATION);
  });
});

describe('Data Model Validation', () => {
  it('should validate DocumentMetadata fields', () => {
    const validMetadata: DocumentMetadata = {
      filename: 'document.docx',
      fileSize: 2048,
      createdDate: new Date('2023-01-01'),
      modifiedDate: new Date('2023-01-02')
    };

    // Test that all required fields are present
    expect(validMetadata.filename).toBeDefined();
    expect(validMetadata.fileSize).toBeGreaterThan(0);
    expect(validMetadata.createdDate).toBeInstanceOf(Date);
    expect(validMetadata.modifiedDate).toBeInstanceOf(Date);
    
    // Test that modified date is after or equal to created date
    expect(validMetadata.modifiedDate.getTime()).toBeGreaterThanOrEqual(
      validMetadata.createdDate.getTime()
    );
  });

  it('should validate ContentElement types', () => {
    const validTypes: ContentElement['type'][] = [
      'heading', 'paragraph', 'list', 'table', 'image'
    ];

    validTypes.forEach(type => {
      const element: ContentElement = {
        type,
        content: `Test ${type} content`
      };
      
      expect(element.type).toBe(type);
      expect(element.content).toBeDefined();
    });
  });

  it('should validate ProcessingOptions combinations', () => {
    const validCleanupLevels: ProcessingOptions['cleanupLevel'][] = [
      'minimal', 'standard', 'aggressive'
    ];
    
    const validOutputFormats: ProcessingOptions['outputFormat'][] = [
      'html', 'markdown', 'plaintext'
    ];

    validCleanupLevels.forEach(cleanupLevel => {
      validOutputFormats.forEach(outputFormat => {
        const options: ProcessingOptions = {
          outputFormat,
          preserveImages: true,
          includeMetadata: false,
          cleanupLevel,
          customSettings: {}
        };
        
        expect(options.cleanupLevel).toBe(cleanupLevel);
        expect(options.outputFormat).toBe(outputFormat);
      });
    });
  });

  it('should validate nested content structure', () => {
    const nestedContent: ContentElement = {
      type: 'list',
      content: 'Main list',
      children: [
        {
          type: 'paragraph',
          content: 'Item 1'
        },
        {
          type: 'list',
          content: 'Nested list',
          children: [
            {
              type: 'paragraph',
              content: 'Nested item 1'
            }
          ]
        }
      ]
    };

    expect(nestedContent.children).toHaveLength(2);
    expect(nestedContent.children![1].children).toHaveLength(1);
    expect(nestedContent.children![1].children![0].content).toBe('Nested item 1');
  });
});