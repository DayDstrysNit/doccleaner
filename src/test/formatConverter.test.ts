import { describe, it, expect } from 'vitest';
import { MultiFormatConverter } from '../services/formatConverter';
import { StructuredContent } from '../models';

describe('MultiFormatConverter', () => {
  const converter = new MultiFormatConverter();
  
  const mockStructuredContent: StructuredContent = {
    title: 'Test Document',
    sections: [
      {
        type: 'heading',
        level: 1,
        content: 'Main Heading'
      },
      {
        type: 'paragraph',
        content: 'This is a test paragraph.'
      },
      {
        type: 'list',
        content: 'First list item'
      },
      {
        type: 'list',
        content: 'Second list item'
      },
      {
        type: 'table',
        content: 'Table content'
      }
    ],
    metadata: {
      processedAt: new Date(),
      processingTime: 1000,
      originalFormat: 'docx',
      warnings: [],
      errors: []
    }
  };

  describe('toPlainText', () => {
    it('should convert structured content to plain text', () => {
      const result = converter.toPlainText(mockStructuredContent);
      
      expect(result).toContain('Test Document');
      expect(result).toContain('Main Heading');
      expect(result).toContain('This is a test paragraph.');
      expect(result).toContain('• First list item');
      expect(result).toContain('• Second list item');
      expect(result).toContain('[Table: Table content]');
    });

    it('should handle content without title', () => {
      const contentWithoutTitle = { ...mockStructuredContent, title: undefined };
      const result = converter.toPlainText(contentWithoutTitle);
      
      expect(result).not.toContain('Test Document');
      expect(result).toContain('Main Heading');
    });

    it('should handle empty sections', () => {
      const emptyContent: StructuredContent = {
        sections: [],
        metadata: mockStructuredContent.metadata
      };
      
      const result = converter.toPlainText(emptyContent);
      expect(result).toBe('');
    });
  });

  describe('toHTML', () => {
    it('should convert structured content to HTML', () => {
      const result = converter.toHTML(mockStructuredContent);
      
      expect(result).toContain('<h1>Test Document</h1>');
      expect(result).toContain('<h1>Main Heading</h1>');
      expect(result).toContain('<p>This is a test paragraph.</p>');
      expect(result).toContain('<li>First list item</li>');
      expect(result).toContain('<li>Second list item</li>');
      expect(result).toContain('<div class="table-content">Table content</div>');
    });

    it('should handle different heading levels', () => {
      const contentWithHeadings: StructuredContent = {
        sections: [
          { type: 'heading', level: 2, content: 'Level 2 Heading' },
          { type: 'heading', level: 6, content: 'Level 6 Heading' },
          { type: 'heading', level: 10, content: 'Level 10 Heading' } // Should cap at 6
        ],
        metadata: mockStructuredContent.metadata
      };
      
      const result = converter.toHTML(contentWithHeadings);
      
      expect(result).toContain('<h2>Level 2 Heading</h2>');
      expect(result).toContain('<h6>Level 6 Heading</h6>');
      expect(result).toContain('<h6>Level 10 Heading</h6>'); // Capped at 6
    });

    it('should escape HTML characters', () => {
      const contentWithHtml: StructuredContent = {
        sections: [
          { type: 'paragraph', content: '<script>alert("test")</script>' }
        ],
        metadata: mockStructuredContent.metadata
      };
      
      const result = converter.toHTML(contentWithHtml);
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('toMarkdown', () => {
    it('should convert structured content to Markdown', () => {
      const result = converter.toMarkdown(mockStructuredContent);
      
      expect(result).toContain('# Test Document');
      expect(result).toContain('# Main Heading');
      expect(result).toContain('This is a test paragraph.');
      expect(result).toContain('- First list item');
      expect(result).toContain('- Second list item');
      expect(result).toContain('**Table:** Table content');
    });

    it('should handle different heading levels', () => {
      const contentWithHeadings: StructuredContent = {
        sections: [
          { type: 'heading', level: 1, content: 'Level 1' },
          { type: 'heading', level: 3, content: 'Level 3' },
          { type: 'heading', level: 6, content: 'Level 6' }
        ],
        metadata: mockStructuredContent.metadata
      };
      
      const result = converter.toMarkdown(contentWithHeadings);
      
      expect(result).toContain('# Level 1');
      expect(result).toContain('### Level 3');
      expect(result).toContain('###### Level 6');
    });

    it('should handle content without title', () => {
      const contentWithoutTitle = { ...mockStructuredContent, title: undefined };
      const result = converter.toMarkdown(contentWithoutTitle);
      
      expect(result).not.toContain('# Test Document');
      expect(result).toContain('# Main Heading');
    });
  });

  describe('toCustomFormat', () => {
    it('should convert to HTML when format is html', () => {
      const options = {
        outputFormat: 'html' as const,
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard' as const,
        customSettings: {}
      };
      
      const result = converter.toCustomFormat(mockStructuredContent, options);
      
      expect(result).toContain('<h1>Test Document</h1>');
      expect(result).toContain('<p>This is a test paragraph.</p>');
    });

    it('should convert to Markdown when format is markdown', () => {
      const options = {
        outputFormat: 'markdown' as const,
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard' as const,
        customSettings: {}
      };
      
      const result = converter.toCustomFormat(mockStructuredContent, options);
      
      expect(result).toContain('# Test Document');
      expect(result).toContain('- First list item');
    });

    it('should convert to plain text when format is plaintext or default', () => {
      const options = {
        outputFormat: 'plaintext' as const,
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard' as const,
        customSettings: {}
      };
      
      const result = converter.toCustomFormat(mockStructuredContent, options);
      
      expect(result).toContain('Test Document');
      expect(result).toContain('• First list item');
    });
  });

  describe('getAvailableFormats', () => {
    it('should return all supported formats', () => {
      const formats = converter.getAvailableFormats();
      
      expect(formats).toEqual(['plaintext', 'html', 'markdown']);
    });
  });
});