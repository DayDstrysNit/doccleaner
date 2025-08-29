/**
 * Example usage of the MammothDocumentParser
 * This file demonstrates how to use the DocumentParser service
 */

import { MammothDocumentParser } from '../services/documentParser';
import { DocumentModel } from '../models';

/**
 * Example function showing basic usage of DocumentParser
 */
export async function parseDocumentExample(filePath: string): Promise<void> {
  const parser = new MammothDocumentParser();

  try {
    // Check if the file format is supported
    console.log('Supported formats:', parser.getSupportedFormats());
    
    if (!parser.isFormatSupported('.docx')) {
      console.error('DOCX format not supported');
      return;
    }

    // Validate the document before parsing
    console.log('Validating document...');
    const isValid = await parser.validateDocument(filePath);
    
    if (!isValid) {
      console.error('Document validation failed');
      return;
    }

    // Parse the document
    console.log('Parsing document...');
    const document: DocumentModel = await parser.parseDocument(filePath);

    // Display document information
    console.log('\n=== Document Information ===');
    console.log(`Filename: ${document.metadata.filename}`);
    console.log(`File size: ${document.metadata.fileSize} bytes`);
    console.log(`Created: ${document.metadata.createdDate}`);
    console.log(`Modified: ${document.metadata.modifiedDate}`);

    // Display content structure
    console.log('\n=== Content Structure ===');
    console.log(`Total content elements: ${document.content.length}`);
    
    const contentSummary = document.content.reduce((acc, element) => {
      acc[element.type] = (acc[element.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(contentSummary).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

    // Display headings hierarchy
    const headings = document.content.filter(el => el.type === 'heading');
    if (headings.length > 0) {
      console.log('\n=== Document Outline ===');
      headings.forEach(heading => {
        const indent = '  '.repeat((heading.level || 1) - 1);
        console.log(`${indent}H${heading.level}: ${heading.content}`);
      });
    }

    // Display first few paragraphs
    const paragraphs = document.content.filter(el => el.type === 'paragraph');
    if (paragraphs.length > 0) {
      console.log('\n=== First Few Paragraphs ===');
      paragraphs.slice(0, 3).forEach((paragraph, index) => {
        console.log(`${index + 1}. ${paragraph.content.substring(0, 100)}${paragraph.content.length > 100 ? '...' : ''}`);
      });
    }

    // Display images information
    if (document.images.length > 0) {
      console.log('\n=== Images ===');
      document.images.forEach(image => {
        console.log(`- ${image.id}: ${image.format} (${image.alt || 'No alt text'})`);
      });
    }

    // Display styles information
    console.log('\n=== Styles ===');
    document.styles.forEach(style => {
      console.log(`- ${style.name} (${style.type})`);
    });

  } catch (error) {
    console.error('Error parsing document:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.filePath) {
      console.error('File path:', error.filePath);
    }
  }
}

/**
 * Example function showing batch validation
 */
export async function validateMultipleDocuments(filePaths: string[]): Promise<void> {
  const parser = new MammothDocumentParser();

  console.log('=== Batch Document Validation ===');
  
  for (const filePath of filePaths) {
    try {
      const isValid = await parser.validateDocument(filePath);
      console.log(`${filePath}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
    } catch (error) {
      console.log(`${filePath}: ✗ Error - ${error.message}`);
    }
  }
}

/**
 * Example function showing error handling
 */
export async function demonstrateErrorHandling(): Promise<void> {
  const parser = new MammothDocumentParser();

  console.log('=== Error Handling Examples ===');

  // Test with non-existent file
  try {
    await parser.parseDocument('/non/existent/file.docx');
  } catch (error) {
    console.log(`Non-existent file error: ${error.constructor.name} - ${error.message}`);
  }

  // Test with unsupported format
  try {
    await parser.parseDocument('/test/document.pdf');
  } catch (error) {
    console.log(`Unsupported format error: ${error.constructor.name} - ${error.message}`);
  }

  // Test format checking
  console.log('\n=== Format Support ===');
  const testFormats = ['.docx', '.doc', '.pdf', '.txt', '.rtf'];
  testFormats.forEach(format => {
    const supported = parser.isFormatSupported(format);
    console.log(`${format}: ${supported ? 'Supported' : 'Not supported'}`);
  });
}

// Example usage (commented out to avoid execution during tests)
/*
async function runExamples() {
  // Parse a single document
  await parseDocumentExample('/path/to/your/document.docx');
  
  // Validate multiple documents
  await validateMultipleDocuments([
    '/path/to/document1.docx',
    '/path/to/document2.docx',
    '/path/to/invalid.pdf'
  ]);
  
  // Demonstrate error handling
  await demonstrateErrorHandling();
}

// Uncomment to run examples
// runExamples().catch(console.error);
*/