import { StructuredContent, ContentSection, ProcessingOptions } from '../models';
import { FormatConverter } from './index';

export class MultiFormatConverter implements FormatConverter {
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
    
    content.sections.forEach(section => {
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
    
    content.sections.forEach(section => {
      markdownParts.push(this.convertSectionToMarkdown(section));
    });
    
    return markdownParts.join('\n').trim();
  }
  
  /**
   * Convert to custom format based on options
   */
  toCustomFormat(content: StructuredContent, options: ProcessingOptions): string {
    switch (options.outputFormat) {
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
  getAvailableFormats(): string[] {
    return ['plaintext', 'html', 'markdown'];
  }
  
  // Private helper methods
  
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
    const content = this.escapeHtml(section.content);
    
    switch (section.type) {
      case 'heading':
        const level = Math.min(section.level || 1, 6);
        return `<h${level}>${content}</h${level}>`;
      case 'paragraph':
        return `<p>${content}</p>`;
      case 'list':
        return `<li>${content}</li>`;
      case 'table':
        return `<div class="table-content">${content}</div>`;
      default:
        return `<div>${content}</div>`;
    }
  }
  
  private convertSectionToMarkdown(section: ContentSection): string {
    switch (section.type) {
      case 'heading':
        const level = Math.min(section.level || 1, 6);
        const hashes = '#'.repeat(level);
        return `${hashes} ${section.content}`;
      case 'paragraph':
        return section.content;
      case 'list':
        return `- ${section.content}`;
      case 'table':
        return `**Table:** ${section.content}`;
      default:
        return section.content;
    }
  }
  
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}