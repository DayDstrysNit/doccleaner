import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MammothDocumentParser } from '../services/documentParser';
import { DocumentParsingError, UnsupportedFormatError, FileAccessError } from '../models/errors';

// Mock mammoth module
vi.mock('mammoth', () => ({
  convertToHtml: vi.fn(),
  images: {
    imgElement: vi.fn()
  }
}));

// Mock fs module
vi.mock('fs/promises');

describe('MammothDocumentParser', () => {
  let parser: MammothDocumentParser;
  let mockMammoth: any;

  beforeEach(async () => {
    parser = new MammothDocumentParser();
    mockMammoth = vi.mocked(await import('mammoth'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSupportedFormats', () => {
    it('should return supported file formats', () => {
      const formats = parser.getSupportedFormats();
      expect(formats).toEqual(['.docx']);
    });
  });

  describe('isFormatSupported', () => {
    it('should return true for supported formats', () => {
      expect(parser.isFormatSupported('.docx')).toBe(true);
      expect(parser.isFormatSupported('.DOCX')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(parser.isFormatSupported('.doc')).toBe(false);
      expect(parser.isFormatSupported('.pdf')).toBe(false);
      expect(parser.isFormatSupported('.txt')).toBe(false);
    });
  });

  describe('validateDocument', () => {
    it('should return true for valid DOCX files', async () => {
      const filePath = '/test/document.docx';
      
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date()
      } as any);

      const result = await parser.validateDocument(filePath);
      expect(result).toBe(true);
    });

    it('should return false for unsupported file extensions', async () => {
      const filePath = '/test/document.pdf';
      const result = await parser.validateDocument(filePath);
      expect(result).toBe(false);
    });

    it('should return false for inaccessible files', async () => {
      const filePath = '/test/document.docx';
      
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const result = await parser.validateDocument(filePath);
      expect(result).toBe(false);
    });

    it('should return false for empty files', async () => {
      const filePath = '/test/document.docx';
      
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 0,
        birthtime: new Date(),
        mtime: new Date()
      } as any);

      const result = await parser.validateDocument(filePath);
      expect(result).toBe(false);
    });

    it('should return false for files that are too large', async () => {
      const filePath = '/test/document.docx';
      const maxSize = 100 * 1024 * 1024; // 100MB
      
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: maxSize + 1,
        birthtime: new Date(),
        mtime: new Date()
      } as any);

      const result = await parser.validateDocument(filePath);
      expect(result).toBe(false);
    });
  });

  describe('parseDocument', () => {
    const mockFilePath = '/test/document.docx';
    const mockBuffer = Buffer.from('mock docx content');
    const mockStats = {
      size: 1024,
      birthtime: new Date('2023-01-01'),
      mtime: new Date('2023-01-02')
    };

    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);
    });

    it('should parse a simple DOCX document with headings and paragraphs', async () => {
      const mockHtml = `
        <h1>Main Title</h1>
        <p>This is a paragraph.</p>
        <h2>Subtitle</h2>
        <p>Another paragraph with <strong>bold text</strong>.</p>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.metadata.filename).toBe('document.docx');
      expect(result.metadata.fileSize).toBe(1024);
      expect(result.content).toHaveLength(4);
      
      // Check heading parsing
      expect(result.content[0]).toEqual({
        type: 'heading',
        level: 1,
        content: 'Main Title'
      });

      // Check paragraph parsing
      expect(result.content[1]).toEqual({
        type: 'paragraph',
        content: 'This is a paragraph.'
      });

      // Check bold text preservation
      expect(result.content[3].content).toContain('**bold text**');
    });

    it('should parse documents with lists', async () => {
      const mockHtml = `
        <p>Introduction</p>
        <li>First item</li>
        <li>Second item</li>
        <li>Third item</li>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content).toHaveLength(4);
      expect(result.content[1].type).toBe('list');
      expect(result.content[1].content).toBe('First item');
      expect(result.content[2].type).toBe('list');
      expect(result.content[2].content).toBe('Second item');
    });

    it('should parse documents with tables', async () => {
      const mockHtml = `
        <p>Table data:</p>
        <table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content).toHaveLength(2);
      expect(result.content[1].type).toBe('table');
      expect(result.content[1].content).toContain('Cell 1');
      expect(result.content[1].content).toContain('Cell 2');
    });

    it('should extract images from document', async () => {
      const mockHtml = `
        <p>Document with image:</p>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" alt="Test image">
        <p>After image</p>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toEqual({
        id: 'img_1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        alt: 'Test image',
        format: 'png'
      });
    });

    it('should handle documents with mixed formatting', async () => {
      const mockHtml = `
        <h1>Title</h1>
        <p>Paragraph with <em>italic</em> and <strong>bold</strong> text.</p>
        <h2>Subtitle</h2>
        <li>List item with <b>bold</b> text</li>
        <p>Final paragraph.</p>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content).toHaveLength(5);
      
      // Check formatting preservation
      expect(result.content[1].content).toContain('*italic*');
      expect(result.content[1].content).toContain('**bold**');
      expect(result.content[3].content).toContain('**bold**');
    });

    it('should throw FileAccessError for inaccessible files', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      await expect(parser.parseDocument(mockFilePath))
        .rejects.toThrow(FileAccessError);
    });

    it('should throw UnsupportedFormatError for unsupported files', async () => {
      const unsupportedFile = '/test/document.pdf';
      
      await expect(parser.parseDocument(unsupportedFile))
        .rejects.toThrow(UnsupportedFormatError);
    });

    it('should throw DocumentParsingError when mammoth fails', async () => {
      mockMammoth.convertToHtml.mockRejectedValue(new Error('Mammoth parsing failed'));

      await expect(parser.parseDocument(mockFilePath))
        .rejects.toThrow(DocumentParsingError);
    });

    it('should handle empty documents gracefully', async () => {
      const mockHtml = '';

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content).toHaveLength(0);
      expect(result.metadata.filename).toBe('document.docx');
    });

    it('should strip HTML entities correctly', async () => {
      const mockHtml = `
        <p>Text with &amp; entities &lt;like&gt; &quot;quotes&quot; and&nbsp;spaces.</p>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content[0].content).toBe('Text with & entities <like> "quotes" and spaces.');
    });

    it('should handle complex heading hierarchy', async () => {
      const mockHtml = `
        <h1>Chapter 1</h1>
        <h2>Section 1.1</h2>
        <h3>Subsection 1.1.1</h3>
        <p>Content</p>
        <h2>Section 1.2</h2>
        <h4>Subsection 1.2.1</h4>
      `;

      mockMammoth.convertToHtml.mockResolvedValue({
        value: mockHtml,
        messages: []
      });

      const result = await parser.parseDocument(mockFilePath);

      expect(result.content).toHaveLength(6);
      expect(result.content[0]).toEqual({ type: 'heading', level: 1, content: 'Chapter 1' });
      expect(result.content[1]).toEqual({ type: 'heading', level: 2, content: 'Section 1.1' });
      expect(result.content[2]).toEqual({ type: 'heading', level: 3, content: 'Subsection 1.1.1' });
      expect(result.content[4]).toEqual({ type: 'heading', level: 2, content: 'Section 1.2' });
      expect(result.content[5]).toEqual({ type: 'heading', level: 4, content: 'Subsection 1.2.1' });
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      const filePath = '/test/nonexistent.docx';
      
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      try {
        await parser.parseDocument(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileAccessError);
        expect(error.message).toContain('Cannot access file');
        expect(error.filePath).toBe(filePath);
      }
    });

    it('should handle mammoth conversion errors gracefully', async () => {
      const filePath = '/test/corrupted.docx';
      
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date()
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('corrupted'));
      
      mockMammoth.convertToHtml.mockRejectedValue(new Error('Invalid DOCX format'));

      try {
        await parser.parseDocument(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentParsingError);
        expect(error.message).toContain('Failed to parse document');
      }
    });
  });
});