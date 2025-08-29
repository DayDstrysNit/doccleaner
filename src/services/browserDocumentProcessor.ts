import mammoth from 'mammoth';
import { StructuredContent, ContentSection, FileProcessingResult } from '../models';

export class BrowserDocumentProcessor {
  async processFile(file: File): Promise<FileProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate file type
      if (!this.isValidDocxFile(file)) {
        return {
          filename: file.name,
          success: false,
          error: 'Invalid file type. Please upload a .docx file.',
          processingTime: Date.now() - startTime
        };
      }

      // Convert file to array buffer for mammoth
      // Handle both modern File API and fallback for older browsers
      let arrayBuffer: ArrayBuffer;
      
      if (typeof file.arrayBuffer === 'function') {
        arrayBuffer = await file.arrayBuffer();
      } else if (file instanceof Blob || (file as any).stream) {
        // Fallback for browsers that don't support arrayBuffer()
        arrayBuffer = await this.fileToArrayBuffer(file);
      } else {
        throw new Error('Unable to read file: File API not supported');
      }
      
      // Extract HTML using mammoth to preserve structure
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      
      // Also extract raw text for fallback and metadata
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      
      // Process the HTML into structured content while preserving lists
      const structuredContent = this.processHtmlToStructuredContent(htmlResult.value, textResult.value, file.name);
      

      
      return {
        filename: file.name,
        success: true,
        output: structuredContent,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        filename: file.name,
        success: false,
        error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  async processFiles(files: File[]): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = [];
    
    // Process files sequentially to avoid overwhelming the browser
    for (const file of files) {
      const result = await this.processFile(file);
      results.push(result);
    }
    
    return results;
  }

  private isValidDocxFile(file: File): boolean {
    // Check file extension
    const validExtensions = ['.docx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    // Check MIME type
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // Sometimes DOCX files have this MIME type
    ];
    const hasValidMimeType = validMimeTypes.includes(file.type) || file.type === '';
    
    return hasValidExtension && (hasValidMimeType || file.type === '');
  }

  private processHtmlToStructuredContent(html: string, rawText: string, filename: string): StructuredContent {
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const sections: ContentSection[] = [];
    const body = doc.body;
    
    // Process each child element in the body
    this.processElement(body, sections);
    
    // Extract title (use first heading or filename)
    const firstHeading = sections.find(s => s.type === 'heading');
    const title = firstHeading ? firstHeading.content : filename.replace(/\.[^/.]+$/, '');

    return {
      title,
      sections,
      metadata: {
        originalFilename: filename,
        processedAt: new Date().toISOString(),
        wordCount: this.countWords(rawText),
        characterCount: rawText.length
      }
    };
  }

  private processElement(element: Element, sections: ContentSection[]): void {
    for (const child of Array.from(element.children)) {
      const tagName = child.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const level = parseInt(tagName.charAt(1));
          const headingText = this.cleanText(child.textContent || '');
          if (headingText.trim()) {
            sections.push({
              type: 'heading',
              content: headingText,
              level: level
            });
          }
          break;
          
        case 'p':
          const paragraphText = this.cleanText(child.textContent || '');
          if (paragraphText.trim()) {
            sections.push({
              type: 'paragraph',
              content: paragraphText
            });
          }
          break;
          
        case 'ol':
          this.processOrderedList(child, sections, 1);
          break;
          
        case 'ul':
          this.processUnorderedList(child, sections, 1);
          break;
          
        case 'table':
          this.processTable(child, sections);
          break;
          
        default:
          // For other elements, recursively process children
          this.processElement(child, sections);
          break;
      }
    }
  }

  private processOrderedList(listElement: Element, sections: ContentSection[], level: number): void {
    const allListItems: string[] = [];
    let itemCounter = 1;
    
    for (const li of Array.from(listElement.children)) {
      if (li.tagName.toLowerCase() === 'li') {
        // Get only the direct text content, excluding nested lists
        const directText = this.getDirectTextContent(li);
        
        if (directText.trim()) {
          // Create proper numbering based on level
          const indent = '  '.repeat(level - 1);
          const numbering = this.getNumbering(itemCounter, level);
          allListItems.push(`${indent}${numbering} ${directText}`);
          itemCounter++;
        }
        
        // Process nested lists and add their items to the same collection
        const nestedOl = li.querySelector('ol');
        const nestedUl = li.querySelector('ul');
        if (nestedOl) {
          const nestedItems = this.processNestedOrderedList(nestedOl, level + 1);
          allListItems.push(...nestedItems);
        }
        if (nestedUl) {
          const nestedItems = this.processNestedUnorderedList(nestedUl, level + 1);
          allListItems.push(...nestedItems);
        }
      }
    }
    
    if (allListItems.length > 0) {
      sections.push({
        type: 'list',
        content: allListItems.join('\n'),
        listType: 'ordered',
        level: level
      });
    }
  }

  private processUnorderedList(listElement: Element, sections: ContentSection[], level: number): void {
    const allListItems: string[] = [];
    
    for (const li of Array.from(listElement.children)) {
      if (li.tagName.toLowerCase() === 'li') {
        // Get only the direct text content, excluding nested lists
        const directText = this.getDirectTextContent(li);
        
        if (directText.trim()) {
          const indent = '  '.repeat(level - 1);
          const bullet = level === 1 ? '•' : level === 2 ? '◦' : '▪';
          allListItems.push(`${indent}${bullet} ${directText}`);
        }
        
        // Process nested lists and add their items to the same collection
        const nestedOl = li.querySelector('ol');
        const nestedUl = li.querySelector('ul');
        if (nestedOl) {
          const nestedItems = this.processNestedOrderedList(nestedOl, level + 1);
          allListItems.push(...nestedItems);
        }
        if (nestedUl) {
          const nestedItems = this.processNestedUnorderedList(nestedUl, level + 1);
          allListItems.push(...nestedItems);
        }
      }
    }
    
    if (allListItems.length > 0) {
      sections.push({
        type: 'list',
        content: allListItems.join('\n'),
        listType: 'unordered',
        level: level
      });
    }
  }

  private processTable(tableElement: Element, sections: ContentSection[]): void {
    const rows: string[] = [];
    
    for (const row of Array.from(tableElement.querySelectorAll('tr'))) {
      const cells: string[] = [];
      for (const cell of Array.from(row.querySelectorAll('td, th'))) {
        const cellText = this.cleanText(cell.textContent || '');
        cells.push(cellText);
      }
      if (cells.length > 0) {
        rows.push(cells.join(' | '));
      }
    }
    
    if (rows.length > 0) {
      sections.push({
        type: 'table',
        content: rows.join('\n')
      });
    }
  }

  private getNumbering(counter: number, level: number): string {
    switch (level) {
      case 1:
        return `${counter}.`;
      case 2:
        return `${String.fromCharCode(96 + counter)}.`; // a., b., c.
      case 3:
        return `${this.toRoman(counter).toLowerCase()}.`; // i., ii., iii.
      case 4:
        return `(${counter})`;
      default:
        return `${counter}.`;
    }
  }

  private toRoman(num: number): string {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += symbols[i];
        num -= values[i];
      }
    }
    
    return result;
  }

  private getDirectTextContent(element: Element): string {
    // Get only the direct text nodes, excluding nested elements
    let directText = '';
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        directText += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName.toLowerCase();
        // Skip nested lists but include other inline elements
        if (tagName !== 'ol' && tagName !== 'ul') {
          directText += (node as Element).textContent || '';
        }
      }
    }
    return this.cleanText(directText);
  }

  private processNestedOrderedList(listElement: Element, level: number): string[] {
    const listItems: string[] = [];
    let itemCounter = 1;
    
    for (const li of Array.from(listElement.children)) {
      if (li.tagName.toLowerCase() === 'li') {
        const directText = this.getDirectTextContent(li);
        
        if (directText.trim()) {
          const indent = '  '.repeat(level - 1);
          const numbering = this.getNumbering(itemCounter, level);
          listItems.push(`${indent}${numbering} ${directText}`);
          itemCounter++;
        }
        
        // Process further nested lists
        const nestedOl = li.querySelector('ol');
        const nestedUl = li.querySelector('ul');
        if (nestedOl) {
          const nestedItems = this.processNestedOrderedList(nestedOl, level + 1);
          listItems.push(...nestedItems);
        }
        if (nestedUl) {
          const nestedItems = this.processNestedUnorderedList(nestedUl, level + 1);
          listItems.push(...nestedItems);
        }
      }
    }
    
    return listItems;
  }

  private processNestedUnorderedList(listElement: Element, level: number): string[] {
    const listItems: string[] = [];
    
    for (const li of Array.from(listElement.children)) {
      if (li.tagName.toLowerCase() === 'li') {
        const directText = this.getDirectTextContent(li);
        
        if (directText.trim()) {
          const indent = '  '.repeat(level - 1);
          const bullet = level === 1 ? '•' : level === 2 ? '◦' : '▪';
          listItems.push(`${indent}${bullet} ${directText}`);
        }
        
        // Process further nested lists
        const nestedOl = li.querySelector('ol');
        const nestedUl = li.querySelector('ul');
        if (nestedOl) {
          const nestedItems = this.processNestedOrderedList(nestedOl, level + 1);
          listItems.push(...nestedItems);
        }
        if (nestedUl) {
          const nestedItems = this.processNestedUnorderedList(nestedUl, level + 1);
          listItems.push(...nestedItems);
        }
      }
    }
    
    return listItems;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '') // Remove non-printable characters
      .trim();
  }



  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsArrayBuffer(file);
    });
  }
}