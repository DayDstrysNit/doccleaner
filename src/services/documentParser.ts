import * as mammoth from 'mammoth';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DocumentParser,
  DocumentModel,
  DocumentMetadata,
  ContentElement,
  ContentElementType,
  StyleDefinition,
  ImageElement
} from './index';
import { DocumentParsingError, UnsupportedFormatError, FileAccessError } from '../models/errors';
import { logger, LogCategories, performanceLogger } from './logger';
import { globalErrorHandler } from './errorHandler';

/**
 * Implementation of DocumentParser service using mammoth.js for DOCX extraction
 */
export class MammothDocumentParser implements DocumentParser {
  private readonly supportedFormats = ['.docx'];
  private readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  /**
   * Parse a DOCX document from file path
   */
  async parseDocument(filePath: string): Promise<DocumentModel> {
    const filename = path.basename(filePath);
    const operationId = `parse_${filename}_${Date.now()}`;
    
    performanceLogger.startTimer(operationId, `Parsing document: ${filename}`);
    
    logger.info(LogCategories.DOCUMENT_PARSING, 
      `Starting document parsing: ${filename}`, 
      { filePath }
    );

    try {
      // Validate file exists and is accessible
      logger.debug(LogCategories.DOCUMENT_PARSING, `Validating file access: ${filename}`);
      await this.validateFileAccess(filePath);
      
      // Validate file format
      logger.debug(LogCategories.DOCUMENT_PARSING, `Validating document format: ${filename}`);
      if (!(await this.validateDocument(filePath))) {
        const error = new UnsupportedFormatError(filePath, path.extname(filePath));
        globalErrorHandler.logError(error, globalErrorHandler.createErrorContext('document_parsing', { filePath }));
        throw error;
      }

      // Get file metadata
      logger.debug(LogCategories.DOCUMENT_PARSING, `Extracting file metadata: ${filename}`);
      const metadata = await this.extractFileMetadata(filePath);

      // Parse document content using mammoth
      logger.debug(LogCategories.DOCUMENT_PARSING, `Converting DOCX to HTML: ${filename}`);
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.convertToHtml(buffer, {
        convertImage: mammoth.images.imgElement((image) => {
          return image.read('base64').then((imageBuffer) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`
            };
          });
        })
      });

      // Log any warnings from mammoth
      if (result.messages && result.messages.length > 0) {
        logger.warn(LogCategories.DOCUMENT_PARSING, 
          `Mammoth parsing warnings for ${filename}`, 
          { warnings: result.messages.map(m => m.message) }
        );
      }

      // Extract structured content from HTML
      logger.debug(LogCategories.DOCUMENT_PARSING, `Parsing HTML to content elements: ${filename}`);
      const content = this.parseHtmlToContentElements(result.value);
      
      // Extract styles (mammoth doesn't provide detailed style info, so we'll create basic ones)
      const styles = this.extractBasicStyles();
      
      // Extract images from the HTML content
      const images = this.extractImages(result.value);

      const processingTime = performanceLogger.endTimer(operationId, `Successfully parsed: ${filename}`);
      
      logger.info(LogCategories.DOCUMENT_PARSING, 
        `Successfully parsed document: ${filename}`, 
        { 
          contentElements: content.length,
          images: images.length,
          styles: styles.length,
          processingTime: `${processingTime}ms`
        }
      );

      return {
        metadata,
        content,
        styles,
        images
      };

    } catch (error) {
      performanceLogger.endTimer(operationId, `Failed to parse: ${filename}`);
      
      if (error instanceof DocumentParsingError || 
          error instanceof UnsupportedFormatError || 
          error instanceof FileAccessError) {
        throw error;
      }
      
      const parsingError = new DocumentParsingError(`Failed to parse document: ${(error as Error).message}`, filePath, error as Error);
      globalErrorHandler.logError(parsingError, globalErrorHandler.createErrorContext('document_parsing', { filePath }));
      throw parsingError;
    }
  }

  /**
   * Validate if a file is a supported document format
   */
  async validateDocument(filePath: string): Promise<boolean> {
    try {
      // Check file extension
      const extension = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(extension)) {
        return false;
      }

      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Basic file size check (not empty, not too large)
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        return false;
      }
      
      // Check for reasonable file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of supported file formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Check if a file extension is supported
   */
  isFormatSupported(extension: string): boolean {
    return this.supportedFormats.includes(extension.toLowerCase());
  }

  /**
   * Validate file access and existence
   */
  private async validateFileAccess(filePath: string): Promise<void> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      const accessError = new FileAccessError(`Cannot access file: ${filePath}`, filePath, error as Error);
      globalErrorHandler.logError(accessError, globalErrorHandler.createErrorContext('file_access', { filePath }));
      throw accessError;
    }
  }

  /**
   * Extract file metadata
   */
  private async extractFileMetadata(filePath: string): Promise<DocumentMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);

      return {
        filename,
        fileSize: stats.size,
        createdDate: stats.birthtime,
        modifiedDate: stats.mtime
      };
    } catch (error) {
      throw new FileAccessError(`Cannot read file metadata: ${filePath}`, filePath);
    }
  }

  /**
   * Parse HTML content from mammoth into structured ContentElements
   */
  private parseHtmlToContentElements(html: string): ContentElement[] {
    const elements: ContentElement[] = [];
    
    // Create a simple HTML parser using regex patterns
    // This is a basic implementation - in production, you might want to use a proper HTML parser
    
    // Split HTML into lines and process each
    const lines = html.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Parse headings (h1-h6)
      const headingMatch = trimmedLine.match(/^<h([1-6])>(.*?)<\/h[1-6]>$/);
      if (headingMatch) {
        elements.push({
          type: 'heading',
          level: parseInt(headingMatch[1]),
          content: this.stripHtmlTags(headingMatch[2])
        });
        continue;
      }

      // Parse paragraphs
      const paragraphMatch = trimmedLine.match(/^<p>(.*?)<\/p>$/);
      if (paragraphMatch) {
        const content = this.stripHtmlTags(paragraphMatch[1]);
        if (content.trim()) {
          elements.push({
            type: 'paragraph',
            content: content
          });
        }
        continue;
      }

      // Parse lists (improved implementation with indentation detection)
      const listItemMatch = trimmedLine.match(/^<li>(.*?)<\/li>$/);
      if (listItemMatch) {
        const content = this.stripHtmlTags(listItemMatch[1]);
        
        // Try to detect indentation from the original HTML structure
        const indentLevel = this.detectListIndentation(html, trimmedLine);
        const indentPrefix = '  '.repeat(indentLevel);
        
        // Detect if this is from an ordered or unordered list by looking at surrounding HTML
        const isOrderedList = this.isFromOrderedList(html, trimmedLine);
        
        // Use different markers that the format converter can distinguish
        // For ordered lists, we'll use a special marker that indicates numbering should be applied
        const listMarker = isOrderedList ? '#NUM#' : '•';
        

        
        elements.push({
          type: 'list',
          content: `${indentPrefix}${listMarker} ${content}`
        });
        continue;
      }

      // Parse tables (basic implementation)
      if (trimmedLine.includes('<table>') || trimmedLine.includes('<tr>') || trimmedLine.includes('<td>')) {
        // For now, treat table content as structured text
        // A more sophisticated implementation would parse the full table structure
        const tableContent = this.stripHtmlTags(trimmedLine);
        if (tableContent.trim()) {
          elements.push({
            type: 'table',
            content: tableContent
          });
        }
        continue;
      }

      // Handle any remaining content as paragraph
      const cleanContent = this.stripHtmlTags(trimmedLine);
      if (cleanContent.trim()) {
        elements.push({
          type: 'paragraph',
          content: cleanContent
        });
      }
    }

    return elements;
  }

  /**
   * Strip HTML tags from content while preserving basic formatting
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**') // Convert strong to markdown bold
      .replace(/<em>(.*?)<\/em>/g, '*$1*') // Convert em to markdown italic
      .replace(/<b>(.*?)<\/b>/g, '**$1**') // Convert b to markdown bold
      .replace(/<i>(.*?)<\/i>/g, '*$1*') // Convert i to markdown italic
      .replace(/<[^>]*>/g, '') // Remove all other HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Extract basic style definitions
   */
  private extractBasicStyles(): StyleDefinition[] {
    // Since mammoth doesn't provide detailed style information,
    // we'll return basic style definitions that are commonly used
    return [
      {
        name: 'Normal',
        type: 'paragraph',
        properties: { fontSize: '12pt', fontFamily: 'Arial' }
      },
      {
        name: 'Heading 1',
        type: 'paragraph',
        properties: { fontSize: '18pt', fontWeight: 'bold' }
      },
      {
        name: 'Heading 2',
        type: 'paragraph',
        properties: { fontSize: '16pt', fontWeight: 'bold' }
      },
      {
        name: 'Heading 3',
        type: 'paragraph',
        properties: { fontSize: '14pt', fontWeight: 'bold' }
      }
    ];
  }

  /**
   * Extract images from HTML content
   */
  private extractImages(html: string): ImageElement[] {
    const images: ImageElement[] = [];
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/g;
    let match;
    let imageId = 1;

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      // Extract alt text more carefully
      const altMatch = html.match(new RegExp(`<img[^>]*src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*alt="([^"]*)"[^>]*>`));
      const alt = altMatch ? altMatch[1] : '';
      
      images.push({
        id: `img_${imageId++}`,
        src,
        alt,
        format: this.getImageFormat(src)
      });
    }

    return images;
  }

  /**
   * Determine image format from source
   */
  private getImageFormat(src: string): string {
    if (src.startsWith('data:image/')) {
      const formatMatch = src.match(/data:image\/([^;]+)/);
      return formatMatch ? formatMatch[1] : 'unknown';
    }
    
    const extension = path.extname(src).toLowerCase().substring(1);
    return extension || 'unknown';
  }
  
  /**
   * Detect list indentation level from HTML structure
   */
  private detectListIndentation(fullHtml: string, currentLine: string): number {
    // This is a simplified heuristic to detect nesting
    // Look for nested <ul> or <ol> tags before the current line
    const beforeCurrentLine = fullHtml.substring(0, fullHtml.indexOf(currentLine));
    
    // Count open list tags minus closed list tags
    const openUlTags = (beforeCurrentLine.match(/<ul[^>]*>/g) || []).length;
    const closeUlTags = (beforeCurrentLine.match(/<\/ul>/g) || []).length;
    const openOlTags = (beforeCurrentLine.match(/<ol[^>]*>/g) || []).length;
    const closeOlTags = (beforeCurrentLine.match(/<\/ol>/g) || []).length;
    
    const nestingLevel = Math.max(0, (openUlTags - closeUlTags) + (openOlTags - closeOlTags) - 1);
    return nestingLevel;
  }
  
  /**
   * Detect if a list item comes from an ordered list
   */
  private isFromOrderedList(fullHtml: string, currentLine: string): boolean {
    // Look backwards from the current line to find the most recent list opening tag
    const beforeCurrentLine = fullHtml.substring(0, fullHtml.indexOf(currentLine));
    
    // Find the last occurrence of either <ul> or <ol> tag
    const lastUlIndex = beforeCurrentLine.lastIndexOf('<ul');
    const lastOlIndex = beforeCurrentLine.lastIndexOf('<ol');
    
    // Check if there's a corresponding closing tag after the opening tag
    const afterLastUl = lastUlIndex >= 0 ? beforeCurrentLine.substring(lastUlIndex) : '';
    const afterLastOl = lastOlIndex >= 0 ? beforeCurrentLine.substring(lastOlIndex) : '';
    
    const ulClosed = afterLastUl.includes('</ul>');
    const olClosed = afterLastOl.includes('</ol>');
    
    // If both exist, use the one that's not closed (most recent open list)
    if (lastUlIndex >= 0 && lastOlIndex >= 0) {
      if (lastOlIndex > lastUlIndex && !olClosed) {
        return true; // Most recent is <ol> and it's still open
      } else if (lastUlIndex > lastOlIndex && !ulClosed) {
        return false; // Most recent is <ul> and it's still open
      }
    }
    
    // If only one exists and it's not closed
    if (lastOlIndex >= 0 && !olClosed) {
      return true;
    }
    if (lastUlIndex >= 0 && !ulClosed) {
      return false;
    }
    
    // Default to unordered if we can't determine
    return false;
  }
}