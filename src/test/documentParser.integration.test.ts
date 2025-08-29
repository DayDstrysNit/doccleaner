import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MammothDocumentParser } from '../services/documentParser';
import { DocumentModel, ContentElement } from '../models';

// Mock mammoth for integration tests
vi.mock('mammoth', () => ({
  convertToHtml: vi.fn(),
  images: {
    imgElement: vi.fn()
  }
}));

// Mock fs for integration tests
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  constants: {
    R_OK: 4
  }
}));

describe('DocumentParser Integration Tests', () => {
  let parser: MammothDocumentParser;
  let mockMammoth: any;
  let mockFs: any;

  beforeEach(async () => {
    parser = new MammothDocumentParser();
    mockMammoth = vi.mocked(await import('mammoth'));
    mockFs = vi.mocked(await import('fs/promises'));
    vi.clearAllMocks();
  });

  it('should integrate with DocumentModel interface correctly', async () => {
    const filePath = '/test/legal-document.docx';
    const mockStats = {
      size: 2048,
      birthtime: new Date('2023-01-01T10:00:00Z'),
      mtime: new Date('2023-01-02T15:30:00Z')
    };

    // Mock file system calls
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue(mockStats);
    mockFs.readFile.mockResolvedValue(Buffer.from('mock docx content'));

    // Mock mammoth conversion with realistic legal document content
    const mockHtml = `
      <h1>LEGAL AGREEMENT</h1>
      <p>This agreement is entered into on <strong>January 1, 2023</strong>.</p>
      <h2>Terms and Conditions</h2>
      <p>The following terms apply:</p>
      <li>Party A agrees to provide services</li>
      <li>Party B agrees to pay compensation</li>
      <li>Both parties agree to <em>confidentiality</em></li>
      <h3>Payment Terms</h3>
      <p>Payment shall be made within 30 days.</p>
      <table><tr><td>Service</td><td>Amount</td></tr><tr><td>Consulting</td><td>$5,000</td></tr></table>
    `;

    mockMammoth.convertToHtml.mockResolvedValue({
      value: mockHtml,
      messages: []
    });

    // Parse the document
    const result: DocumentModel = await parser.parseDocument(filePath);

    // Verify DocumentModel structure
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('styles');
    expect(result).toHaveProperty('images');

    // Verify metadata
    expect(result.metadata.filename).toBe('legal-document.docx');
    expect(result.metadata.fileSize).toBe(2048);
    expect(result.metadata.createdDate).toEqual(mockStats.birthtime);
    expect(result.metadata.modifiedDate).toEqual(mockStats.mtime);

    // Verify content structure
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content.length).toBeGreaterThan(0);

    // Verify content elements follow ContentElement interface
    result.content.forEach((element: ContentElement) => {
      expect(element).toHaveProperty('type');
      expect(element).toHaveProperty('content');
      expect(['heading', 'paragraph', 'list', 'table']).toContain(element.type);
      
      if (element.type === 'heading') {
        expect(element).toHaveProperty('level');
        expect(element.level).toBeGreaterThanOrEqual(1);
        expect(element.level).toBeLessThanOrEqual(6);
      }
    });

    // Verify specific content parsing
    const headings = result.content.filter(el => el.type === 'heading');
    expect(headings).toHaveLength(3);
    expect(headings[0].content).toBe('LEGAL AGREEMENT');
    expect(headings[0].level).toBe(1);
    expect(headings[1].content).toBe('Terms and Conditions');
    expect(headings[1].level).toBe(2);

    const paragraphs = result.content.filter(el => el.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphs[0].content).toContain('**January 1, 2023**');

    const listItems = result.content.filter(el => el.type === 'list');
    expect(listItems).toHaveLength(3);
    expect(listItems[2].content).toContain('*confidentiality*');

    const tables = result.content.filter(el => el.type === 'table');
    expect(tables).toHaveLength(1);
    expect(tables[0].content).toContain('Service');
    expect(tables[0].content).toContain('$5,000');

    // Verify styles array
    expect(result.styles).toBeInstanceOf(Array);
    expect(result.styles.length).toBeGreaterThan(0);
    result.styles.forEach(style => {
      expect(style).toHaveProperty('name');
      expect(style).toHaveProperty('type');
      expect(style).toHaveProperty('properties');
    });

    // Verify images array (empty in this case)
    expect(result.images).toBeInstanceOf(Array);
  });

  it('should handle complex document structures with nested content', async () => {
    const filePath = '/test/complex-document.docx';
    
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      mtime: new Date()
    });
    mockFs.readFile.mockResolvedValue(Buffer.from('mock content'));

    // Complex nested structure
    const mockHtml = `
      <h1>Main Title</h1>
      <p>Introduction paragraph.</p>
      <h2>Section A</h2>
      <p>Section A content with <strong>bold</strong> and <em>italic</em> text.</p>
      <h3>Subsection A.1</h3>
      <li>First point</li>
      <li>Second point with <b>emphasis</b></li>
      <h3>Subsection A.2</h3>
      <p>More content here.</p>
      <h2>Section B</h2>
      <table><tr><td>Header 1</td><td>Header 2</td></tr></table>
    `;

    mockMammoth.convertToHtml.mockResolvedValue({
      value: mockHtml,
      messages: []
    });

    const result = await parser.parseDocument(filePath);

    // Verify hierarchical structure is preserved
    const headingLevels = result.content
      .filter(el => el.type === 'heading')
      .map(el => el.level);
    
    expect(headingLevels).toEqual([1, 2, 3, 3, 2]);

    // Verify content types are correctly identified
    const contentTypes = result.content.map(el => el.type);
    expect(contentTypes).toContain('heading');
    expect(contentTypes).toContain('paragraph');
    expect(contentTypes).toContain('list');
    expect(contentTypes).toContain('table');

    // Verify formatting preservation
    const formattedContent = result.content.find(el => 
      el.content.includes('**bold**') && el.content.includes('*italic*')
    );
    expect(formattedContent).toBeDefined();
  });

  it('should validate requirements compliance', async () => {
    // This test verifies that the parser meets the specific requirements
    const filePath = '/test/requirements-test.docx';
    
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      mtime: new Date()
    });
    mockFs.readFile.mockResolvedValue(Buffer.from('test content'));

    // Test content that covers all requirements
    const mockHtml = `
      <h1>Document Title</h1>
      <p>Paragraph with various formatting: <strong>bold</strong>, <em>italic</em>, and normal text.</p>
      <h2>Lists Section</h2>
      <li>Bulleted item 1</li>
      <li>Bulleted item 2</li>
      <h3>Tables Section</h3>
      <table><tr><td>Column 1</td><td>Column 2</td></tr><tr><td>Data 1</td><td>Data 2</td></tr></table>
      <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD" alt="Sample image">
    `;

    mockMammoth.convertToHtml.mockResolvedValue({
      value: mockHtml,
      messages: []
    });

    const result = await parser.parseDocument(filePath);

    // Requirement 1.1: Extract text content while preserving paragraph structure
    expect(result.content.some(el => el.type === 'paragraph')).toBe(true);

    // Requirement 2.1: Convert heading styles to appropriate levels
    const headings = result.content.filter(el => el.type === 'heading');
    expect(headings.length).toBeGreaterThan(0);
    expect(headings.every(h => h.level >= 1 && h.level <= 6)).toBe(true);

    // Requirement 2.2: Preserve list structure
    const lists = result.content.filter(el => el.type === 'list');
    expect(lists.length).toBeGreaterThan(0);

    // Requirement 2.3: Preserve basic formatting (bold/italic)
    const formattedContent = result.content.find(el => 
      el.content.includes('**') || el.content.includes('*')
    );
    expect(formattedContent).toBeDefined();

    // Requirement 2.4: Convert tables to clean format
    const tables = result.content.filter(el => el.type === 'table');
    expect(tables.length).toBeGreaterThan(0);

    // Requirement 3.2: Support DOCX format
    expect(parser.getSupportedFormats()).toContain('.docx');
    expect(parser.isFormatSupported('.docx')).toBe(true);

    // Verify images are extracted
    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]).toHaveProperty('id');
    expect(result.images[0]).toHaveProperty('src');
    expect(result.images[0]).toHaveProperty('format');
  });
});