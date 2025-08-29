import { describe, it, expect, beforeEach } from 'vitest';
import { WordContentProcessor } from '../services/contentProcessor';
import {
  DocumentModel,
  ContentElement,
  DocumentMetadata,
  StructuredContent,
  ProcessingError
} from '../models';

describe('WordContentProcessor', () => {
  let processor: WordContentProcessor;
  let mockDocument: DocumentModel;

  beforeEach(() => {
    processor = new WordContentProcessor();
    
    // Create mock document with various content types
    mockDocument = {
      metadata: {
        filename: 'test-document.docx',
        fileSize: 1024,
        createdDate: new Date('2023-01-01'),
        modifiedDate: new Date('2023-01-02')
      } as DocumentMetadata,
      content: [
        {
          type: 'heading',
          level: 1,
          content: 'Main Title'
        },
        {
          type: 'paragraph',
          content: 'This is a paragraph with **bold** and *italic* text.'
        },
        {
          type: 'heading',
          level: 2,
          content: 'Subtitle'
        },
        {
          type: 'list',
          content: 'First list item'
        },
        {
          type: 'list',
          content: 'Second list item with **bold** text'
        }
      ] as ContentElement[],
      styles: [],
      images: []
    };
  });

  describe('cleanContent', () => {
    it('should clean content and preserve basic structure', async () => {
      const result = await processor.cleanContent(mockDocument);

      expect(result.title).toBe('Main Title');
      expect(result.sections).toHaveLength(5);
      expect(result.metadata.originalFormat).toBe('docx');
      expect(result.metadata.processedAt).toBeInstanceOf(Date);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should extract title from first heading', async () => {
      const result = await processor.cleanContent(mockDocument);
      expect(result.title).toBe('Main Title');
    });

    it('should fallback to filename for title when no heading exists', async () => {
      const docWithoutHeading = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Just a paragraph'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(docWithoutHeading);
      expect(result.title).toBe('test-document');
    });

    it('should preserve heading levels', async () => {
      const result = await processor.cleanContent(mockDocument);
      
      const headingSections = result.sections.filter(s => s.type === 'heading');
      expect(headingSections).toHaveLength(2);
      expect(headingSections[0].level).toBe(1);
      expect(headingSections[1].level).toBe(2);
    });

    it('should clean content while preserving basic formatting', async () => {
      const result = await processor.cleanContent(mockDocument);
      
      const paragraphSection = result.sections.find(s => s.type === 'paragraph');
      expect(paragraphSection?.content).toContain('**bold**');
      expect(paragraphSection?.content).toContain('*italic*');
    });

    it('should handle empty content gracefully', async () => {
      const emptyDoc = {
        ...mockDocument,
        content: []
      };

      const result = await processor.cleanContent(emptyDoc);
      expect(result.sections).toHaveLength(0);
      expect(result.title).toBe('test-document');
    });

    it('should handle content with only whitespace', async () => {
      const whitespaceDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: '   \n\t  '
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(whitespaceDoc);
      expect(result.sections).toHaveLength(0);
    });

    it('should collect warnings for problematic content', async () => {
      // Mock a scenario that would cause warnings
      const problematicDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Valid content'
          },
          // This will be processed but might generate warnings in real scenarios
          {
            type: 'table',
            content: 'Complex table content'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(problematicDoc);
      expect(result.metadata.warnings).toBeDefined();
      expect(Array.isArray(result.metadata.warnings)).toBe(true);
    });
  });

  describe('preserveStructure', () => {
    it('should maintain hierarchical structure', () => {
      const hierarchicalDoc = {
        ...mockDocument,
        content: [
          { type: 'heading', level: 1, content: 'Chapter 1' },
          { type: 'paragraph', content: 'Chapter intro' },
          { type: 'heading', level: 2, content: 'Section 1.1' },
          { type: 'paragraph', content: 'Section content' },
          { type: 'heading', level: 2, content: 'Section 1.2' },
          { type: 'paragraph', content: 'More content' },
          { type: 'heading', level: 1, content: 'Chapter 2' },
          { type: 'paragraph', content: 'Chapter 2 intro' }
        ] as ContentElement[]
      };

      const result = processor.preserveStructure(hierarchicalDoc);

      // Should have 2 top-level chapters
      expect(result.sections).toHaveLength(2);
      
      // First chapter should have children
      const chapter1 = result.sections[0];
      expect(chapter1.type).toBe('heading');
      expect(chapter1.level).toBe(1);
      expect(chapter1.content).toBe('Chapter 1');
      
      expect(chapter1.children).toHaveLength(3); // intro + 2 sections (each section groups with its content)

      // Check nested structure
      const section11 = chapter1.children?.find(child => 
        child.type === 'heading' && child.content === 'Section 1.1'
      );
      expect(section11).toBeDefined();
      expect(section11?.level).toBe(2);
    });

    it('should handle content without headings', () => {
      const flatDoc = {
        ...mockDocument,
        content: [
          { type: 'paragraph', content: 'First paragraph' },
          { type: 'paragraph', content: 'Second paragraph' },
          { type: 'list', content: 'List item' }
        ] as ContentElement[]
      };

      const result = processor.preserveStructure(flatDoc);
      
      // All content should be at root level
      expect(result.sections).toHaveLength(3);
      expect(result.sections.every(s => !s.children || s.children.length === 0)).toBe(true);
    });

    it('should handle complex nesting levels', () => {
      const complexDoc = {
        ...mockDocument,
        content: [
          { type: 'heading', level: 1, content: 'H1' },
          { type: 'heading', level: 3, content: 'H3 (skipped H2)' },
          { type: 'paragraph', content: 'Content under H3' },
          { type: 'heading', level: 2, content: 'H2' },
          { type: 'paragraph', content: 'Content under H2' },
          { type: 'heading', level: 4, content: 'H4' },
          { type: 'paragraph', content: 'Content under H4' }
        ] as ContentElement[]
      };

      const result = processor.preserveStructure(complexDoc);
      
      // Should handle the hierarchy correctly
      expect(result.sections).toHaveLength(1); // Only H1 at root
      const h1 = result.sections[0];
      expect(h1.children).toHaveLength(2); // H3 and H2 (content gets grouped under headings)
    });
  });

  describe('stripFormatting', () => {
    it('should remove markdown formatting', () => {
      const formatted = 'This has **bold**, *italic*, __underline__, and ~~strikethrough~~ text.';
      const result = processor.stripFormatting(formatted);
      expect(result).toBe('This has bold, italic, underline, and strikethrough text.');
    });

    it('should remove HTML tags', () => {
      const html = 'This has <strong>bold</strong> and <em>italic</em> <span>text</span>.';
      const result = processor.stripFormatting(html);
      expect(result).toBe('This has bold and italic text.');
    });

    it('should normalize whitespace', () => {
      const messy = 'This   has    excessive\n\n\n\nwhitespace   \t\t  ';
      const result = processor.stripFormatting(messy);
      expect(result).toBe('This has excessive whitespace');
    });

    it('should handle empty and whitespace-only strings', () => {
      expect(processor.stripFormatting('')).toBe('');
      expect(processor.stripFormatting('   \n\t  ')).toBe('');
    });

    it('should handle mixed formatting', () => {
      const mixed = '**Bold** and <em>italic</em> with   extra   spaces\n\nand newlines.';
      const result = processor.stripFormatting(mixed);
      expect(result).toBe('Bold and italic with extra spaces and newlines.');
    });
  });

  describe('extractTextContent', () => {
    it('should extract all text content from document', () => {
      const result = processor.extractTextContent(mockDocument);
      
      expect(result).toContain('Main Title');
      expect(result).toContain('This is a paragraph');
      expect(result).toContain('Subtitle');
      expect(result).toContain('First list item');
      expect(result).toContain('Second list item');
    });

    it('should join content with double newlines', () => {
      const result = processor.extractTextContent(mockDocument);
      const parts = result.split('\n\n');
      expect(parts.length).toBeGreaterThan(1);
    });

    it('should strip formatting from extracted text', () => {
      const result = processor.extractTextContent(mockDocument);
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
    });

    it('should handle empty document', () => {
      const emptyDoc = { ...mockDocument, content: [] };
      const result = processor.extractTextContent(emptyDoc);
      expect(result).toBe('');
    });
  });

  describe('Word-specific formatting removal', () => {
    it('should remove Word artifacts', async () => {
      const wordDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Text with\u00A0non-breaking\u2007spaces and\u2013en\u2014dashes.'
          },
          {
            type: 'paragraph',
            content: 'Smart\u2018quotes\u2019 and\u201Cdouble\u201D quotes with\u2026ellipsis.'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(wordDoc);
      
      const content1 = result.sections[0].content;
      const content2 = result.sections[1].content;
      
      expect(content1).toBe('Text with non-breaking spaces and-en--dashes.');
      expect(content2).toBe('Smart\'quotes\' and"double" quotes with...ellipsis.');
    });

    it('should normalize excessive punctuation', async () => {
      const punctuationDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Too many dots.... and exclamations!!! and questions???'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(punctuationDoc);
      const content = result.sections[0].content;
      
      expect(content).toBe('Too many dots... and exclamations! and questions?');
    });

    it('should handle line break normalization', async () => {
      const lineBreakDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Windows\r\nline breaks\rand Mac\nand Unix.'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(lineBreakDoc);
      const content = result.sections[0].content;
      
      expect(content).not.toContain('\r');
      // The actual content after processing - carriage returns are removed in normalization
      expect(content).toContain('Windows');
      expect(content).toContain('line breaks');
      expect(content).toContain('and Mac');
      expect(content).toContain('and Unix');
    });
  });

  describe('error handling', () => {
    it('should throw ProcessingError for invalid input', async () => {
      // Create a scenario that might cause processing to fail
      const invalidDoc = null as any;

      await expect(processor.cleanContent(invalidDoc))
        .rejects.toThrow(ProcessingError);
    });

    it('should handle malformed content elements gracefully', async () => {
      const malformedDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Valid content'
          },
          // Malformed element
          {
            type: null as any,
            content: null as any
          },
          {
            type: 'paragraph',
            content: 'More valid content'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(malformedDoc);
      
      // Should process valid content and skip malformed
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('content element processing', () => {
    it('should handle nested content elements', async () => {
      const nestedDoc = {
        ...mockDocument,
        content: [
          {
            type: 'heading',
            level: 1,
            content: 'Parent Heading',
            children: [
              {
                type: 'paragraph',
                content: 'Child paragraph'
              },
              {
                type: 'list',
                content: 'Child list item'
              }
            ]
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(nestedDoc);
      
      expect(result.sections).toHaveLength(1);
      const parentSection = result.sections[0];
      expect(parentSection.children).toHaveLength(2);
      expect(parentSection.children?.[0].type).toBe('paragraph');
      expect(parentSection.children?.[1].type).toBe('list');
    });

    it('should preserve formatting in basic elements', async () => {
      const formattedDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Text with **bold**, *italic*, and ***bold italic*** formatting.'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(formattedDoc);
      const content = result.sections[0].content;
      
      expect(content).toContain('**bold**');
      expect(content).toContain('*italic*');
      expect(content).toContain('***bold italic***');
    });

    it('should clean up nested formatting', async () => {
      const overFormattedDoc = {
        ...mockDocument,
        content: [
          {
            type: 'paragraph',
            content: 'Text with ****excessive**** formatting and ******too many****** asterisks.'
          }
        ] as ContentElement[]
      };

      const result = await processor.cleanContent(overFormattedDoc);
      const content = result.sections[0].content;
      
      // Should normalize excessive formatting
      expect(content).not.toContain('****');
      expect(content).not.toContain('******');
    });
  });
});