import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OutputManager from '../components/OutputManager';

describe('OutputManager - Simple Tests', () => {
  it('should render empty state when no results provided', () => {
    render(<OutputManager results={[]} />);
    
    expect(screen.getByText('No processing results available.')).toBeInTheDocument();
  });

  it('should render with successful results', () => {
    const mockResults = [
      {
        filename: 'test.docx',
        success: true,
        output: {
          title: 'Test',
          sections: [{ type: 'paragraph' as const, content: 'Test content' }],
          metadata: {
            processedAt: new Date(),
            processingTime: 1000,
            originalFormat: 'docx',
            warnings: [],
            errors: []
          }
        },
        processingTime: 1500
      }
    ];

    render(<OutputManager results={mockResults} />);
    
    expect(screen.getByText('Output Management')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 files processed successfully')).toBeInTheDocument();
    expect(screen.getByText('test.docx')).toBeInTheDocument();
  });
});