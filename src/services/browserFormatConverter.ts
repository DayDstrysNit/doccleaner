import { StructuredContent, ContentSection } from '../models';

export class BrowserFormatConverter {
  /**
   * Convert structured content to plain text
   */
  toPlainText(content: StructuredContent): string {
    const lines: string[] = [];
    
    if (content.title) {
      lines.push(content.title);
      lines.push(''); // Empty line after title
    }
    
    content.sections.forEach(section => {
      this.convertSectionToPlainText(section, lines, 0);
    });
    
    return lines.join('\n').trim();
  }
  
  /**
   * Convert structured content to HTML
   */
  toHTML(content: StructuredContent): string {
    const htmlParts: string[] = [];
    
    if (content.title) {
      htmlParts.push(`<h1>${this.escapeHtml(content.title)}</h1>`);
    }
    
    // Group consecutive list items and convert sections
    const processedSections = this.groupListSections(content.sections);
    processedSections.forEach(section => {
      htmlParts.push(this.convertSectionToHTML(section));
    });
    
    return htmlParts.join('\n');
  }
  
  /**
   * Convert structured content to Markdown
   */
  toMarkdown(content: StructuredContent): string {
    const markdownParts: string[] = [];
    
    if (content.title) {
      markdownParts.push(`# ${content.title}`);
      markdownParts.push(''); // Empty line after title
    }
    
    // Group consecutive list items and convert sections
    const processedSections = this.groupListSections(content.sections);
    processedSections.forEach(section => {
      markdownParts.push(this.convertSectionToMarkdown(section));
    });
    
    return markdownParts.join('\n').trim();
  }
  
  /**
   * Convert to custom format based on format type
   */
  toFormat(content: StructuredContent, format: 'plaintext' | 'html' | 'markdown'): string {
    switch (format) {
      case 'html':
        return this.toHTML(content);
      case 'markdown':
        return this.toMarkdown(content);
      case 'plaintext':
      default:
        return this.toPlainText(content);
    }
  }
  
  /**
   * Get available output formats
   */
  getAvailableFormats(): Array<{key: string, label: string, extension: string}> {
    return [
      { key: 'plaintext', label: 'Plain Text', extension: 'txt' },
      { key: 'html', label: 'HTML', extension: 'html' },
      { key: 'markdown', label: 'Markdown', extension: 'md' }
    ];
  }
  
  // Private helper methods
  
  /**
   * Group consecutive list items into proper list structures
   */
  private groupListSections(sections: ContentSection[]): ContentSection[] {
    const grouped: ContentSection[] = [];
    let currentListItems: ContentSection[] = [];
    let currentListType: 'ordered' | 'unordered' | null = null;
    
    for (const section of sections) {
      if (section.type === 'list') {
        // Determine list type based on content pattern
        // Look for our special ordered list marker or actual numbering
        const hasOrderedMarker = /^\s*#NUM#\s/.test(section.content);
        const hasNumbering = /^\s*\d+[\.\)]\s/.test(section.content) || 
                            /^\s*[a-zA-Z][\.\)]\s/.test(section.content) ||
                            /^\s*[ivxlcdm]+[\.\)]\s/i.test(section.content); // Roman numerals
        
        // Also check if it starts with bullet characters
        const hasBullets = /^\s*[•◦▪\-\*\+]\s/.test(section.content);
        
        // Determine list type
        const listType = (hasOrderedMarker || hasNumbering) ? 'ordered' : 'unordered';
        
        // If this is a different list type, finish the current list
        if (currentListType && currentListType !== listType) {
          if (currentListItems.length > 0) {
            grouped.push(this.createListSection(currentListItems, currentListType));
            currentListItems = [];
          }
        }
        
        currentListType = listType;
        currentListItems.push(section);
      } else {
        // Non-list item, finish current list if any
        if (currentListItems.length > 0) {
          grouped.push(this.createListSection(currentListItems, currentListType!));
          currentListItems = [];
          currentListType = null;
        }
        grouped.push(section);
      }
    }
    
    // Handle any remaining list items
    if (currentListItems.length > 0) {
      grouped.push(this.createListSection(currentListItems, currentListType!));
    }
    
    return grouped;
  }
  
  /**
   * Create a grouped list section from individual list items
   */
  private createListSection(items: ContentSection[], listType: 'ordered' | 'unordered'): ContentSection {
    // Combine all list items into a single content string with proper indentation
    const combinedContent = items.map(item => item.content).join('\n');
    
    return {
      type: 'list',
      content: combinedContent,
      listType: listType
    };
  }
  
  private convertSectionToPlainText(section: ContentSection, lines: string[], depth: number): void {
    const indent = '  '.repeat(depth);
    
    switch (section.type) {
      case 'heading':
        lines.push(`${indent}${section.content}`);
        lines.push(''); // Empty line after heading
        break;
      case 'paragraph':
        lines.push(`${indent}${section.content}`);
        lines.push(''); // Empty line after paragraph
        break;
      case 'list':
        lines.push(`${indent}• ${section.content}`);
        break;
      case 'table':
        lines.push(`${indent}[Table: ${section.content}]`);
        lines.push(''); // Empty line after table
        break;
      default:
        lines.push(`${indent}${section.content}`);
        break;
    }
    
    // Process children recursively
    if (section.children) {
      section.children.forEach(child => {
        this.convertSectionToPlainText(child, lines, depth + 1);
      });
    }
  }
  
  private convertSectionToHTML(section: ContentSection): string {
    switch (section.type) {
      case 'heading':
        const level = Math.min(section.level || 2, 6);
        const headingContent = this.escapeHtml(section.content);
        return `<h${level}>${headingContent}</h${level}>`;
      case 'paragraph':
        const paragraphContent = this.escapeHtml(section.content);
        return `<p>${paragraphContent}</p>`;
      case 'list':
        return this.convertListToHTML(section.content, (section as any).listType === 'ordered');
      case 'table':
        const tableContent = this.escapeHtml(section.content);
        return `<div class="table-content">${tableContent}</div>`;
      default:
        const defaultContent = this.escapeHtml(section.content);
        return `<div>${defaultContent}</div>`;
    }
  }
  
  /**
   * Convert list content to proper nested HTML
   */
  private convertListToHTML(listContent: string, isOrdered: boolean): string {
    const lines = listContent.split('\n');
    const result: string[] = [];
    const stack: { level: number; tag: string }[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Calculate indentation level (each 2 spaces = 1 level)
      const indentMatch = line.match(/^(\s*)/);
      const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      
      // Determine if this specific line is ordered or unordered
      const hasOrderedMarker = /^\s*#NUM#\s/.test(line);
      const hasNumbering = /^\s*\d+[\.\)]\s/.test(line) || 
                          /^\s*[a-zA-Z][\.\)]\s/.test(line) ||
                          /^\s*[ivxlcdm]+[\.\)]\s/i.test(line);
      const lineIsOrdered = hasOrderedMarker || hasNumbering;
      
      // Extract the content without bullets/numbers/special markers
      const content = line.replace(/^[\s]*([•◦▪\d\w\(\)\.]+|#NUM#)\s*/, '').trim();
      
      if (!content) continue;
      
      // Close lists if we've decreased in level or changed list type
      while (stack.length > 0 && 
             (stack[stack.length - 1].level >= indentLevel || 
              (stack[stack.length - 1].level === indentLevel && 
               ((stack[stack.length - 1].tag === 'ol') !== lineIsOrdered)))) {
        const closed = stack.pop()!;
        result.push(`</${closed.tag}>`);
      }
      
      // Open new list if we've increased in level or need a different list type
      if (stack.length === 0 || 
          stack[stack.length - 1].level < indentLevel ||
          (stack[stack.length - 1].level === indentLevel && 
           ((stack[stack.length - 1].tag === 'ol') !== lineIsOrdered))) {
        const listTag = lineIsOrdered ? 'ol' : 'ul';
        result.push(`<${listTag}>`);
        stack.push({ level: indentLevel, tag: listTag });
      }
      
      // Add the list item
      result.push(`<li>${this.escapeHtml(content)}</li>`);
    }
    
    // Close any remaining open lists
    while (stack.length > 0) {
      const closed = stack.pop()!;
      result.push(`</${closed.tag}>`);
    }
    
    return result.join('\n');
  }
  
  private convertSectionToMarkdown(section: ContentSection): string {
    switch (section.type) {
      case 'heading':
        const level = Math.min(section.level || 2, 6);
        const hashes = '#'.repeat(level);
        return `${hashes} ${section.content}`;
      case 'paragraph':
        return section.content;
      case 'list':
        return this.convertListToMarkdown(section.content, (section as any).listType === 'ordered');
      case 'table':
        return `**Table:** ${section.content}`;
      default:
        return section.content;
    }
  }
  
  /**
   * Convert list content to proper nested Markdown
   */
  private convertListToMarkdown(listContent: string, isOrdered: boolean): string {
    const lines = listContent.split('\n').filter(line => line.trim());
    const result: string[] = [];
    const numberCounters: { [level: number]: number } = {};
    
    for (const item of lines) {
      if (!item.trim()) continue;
      
      // Calculate indentation level (each 2 spaces = 1 level)
      const indentMatch = item.match(/^(\s*)/);
      const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      const indent = '  '.repeat(indentLevel);
      
      // Determine if this specific line is ordered or unordered
      const hasOrderedMarker = /^\s*#NUM#\s/.test(item);
      const hasNumbering = /^\s*\d+[\.\)]\s/.test(item) || 
                          /^\s*[a-zA-Z][\.\)]\s/.test(item) ||
                          /^\s*[ivxlcdm]+[\.\)]\s/i.test(item);
      const lineIsOrdered = hasOrderedMarker || hasNumbering;
      
      // Extract the content without bullets/numbers/special markers
      const content = item.replace(/^[\s]*([•◦▪\d\w\(\)\.]+|#NUM#)\s*/, '').trim();
      
      if (lineIsOrdered) {
        // Initialize or increment counter for this level
        if (!(indentLevel in numberCounters)) {
          numberCounters[indentLevel] = 1;
        } else {
          numberCounters[indentLevel]++;
        }
        
        // Reset counters for deeper levels when we encounter a new item at this level
        Object.keys(numberCounters).forEach(level => {
          if (parseInt(level) > indentLevel) {
            delete numberCounters[parseInt(level)];
          }
        });
        
        result.push(`${indent}${numberCounters[indentLevel]}. ${content}`);
      } else {
        // Use bullets for unordered lists
        result.push(`${indent}- ${content}`);
      }
    }
    
    return result.join('\n');
  }
  
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}