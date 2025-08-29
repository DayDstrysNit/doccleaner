import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PreviewPanel from '../components/PreviewPanel';

describe('PreviewPanel - Simple Tests', () => {
  it('should render empty state when no content provided', () => {
    render(<PreviewPanel outputFormat="plaintext" />);
    
    expect(screen.getByText('No content to preview. Process a document to see the results.')).toBeInTheDocument();
  });

  it('should render with basic content', () => {
    const mockContent = {
      title: 'Test Document',
      sections: [
        {
          type: 'paragraph' as const,
          content: 'Test paragraph'
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

    render(<PreviewPanel convertedContent={mockContent} outputFormat="plaintext" />);
    
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });
});