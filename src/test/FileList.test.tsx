import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileList from '../components/FileList';
import { FileInfo } from '../components/FileSelector';

// Helper function to create mock FileInfo
const createMockFileInfo = (
  name: string,
  size: number,
  isValid: boolean = true,
  validationError?: string
): FileInfo => ({
  file: new File(['mock content'], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  name,
  size,
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  lastModified: new Date('2024-01-01'),
  isValid,
  validationError
});

describe('FileList', () => {
  const mockOnRemoveFile = vi.fn();
  const mockOnClearAll = vi.fn();

  beforeEach(() => {
    mockOnRemoveFile.mockClear();
    mockOnClearAll.mockClear();
  });

  it('renders nothing when no files are provided', () => {
    const { container } = render(
      <FileList 
        files={[]} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders file list with valid files', () => {
    const files = [
      createMockFileInfo('document1.docx', 1024 * 1024),
      createMockFileInfo('document2.docx', 2 * 1024 * 1024)
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('Valid Files (2)')).toBeInTheDocument();
    expect(screen.getByText('document1.docx')).toBeInTheDocument();
    expect(screen.getByText('document2.docx')).toBeInTheDocument();
    expect(screen.getByText('1 MB • 12/31/2023')).toBeInTheDocument();
    expect(screen.getByText('2 MB • 12/31/2023')).toBeInTheDocument();
  });

  it('renders file list with invalid files', () => {
    const files = [
      createMockFileInfo('invalid.pdf', 1024, false, 'File format ".pdf" is not supported'),
      createMockFileInfo('toolarge.docx', 100 * 1024 * 1024, false, 'File size exceeds maximum')
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('Invalid Files (2)')).toBeInTheDocument();
    expect(screen.getByText('invalid.pdf')).toBeInTheDocument();
    expect(screen.getByText('toolarge.docx')).toBeInTheDocument();
    expect(screen.getByText('File format ".pdf" is not supported')).toBeInTheDocument();
    expect(screen.getByText('File size exceeds maximum')).toBeInTheDocument();
  });

  it('renders mixed valid and invalid files', () => {
    const files = [
      createMockFileInfo('valid.docx', 1024),
      createMockFileInfo('invalid.pdf', 1024, false, 'Unsupported format')
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('Valid Files (1)')).toBeInTheDocument();
    expect(screen.getByText('Invalid Files (1)')).toBeInTheDocument();
  });

  it('calls onRemoveFile when remove button is clicked', () => {
    const files = [
      createMockFileInfo('document1.docx', 1024),
      createMockFileInfo('document2.docx', 2048)
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    const removeButtons = screen.getAllByLabelText(/Remove/);
    fireEvent.click(removeButtons[0]);

    expect(mockOnRemoveFile).toHaveBeenCalledWith(0);
  });

  it('calls onClearAll when clear all button is clicked', () => {
    const files = [createMockFileInfo('document.docx', 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    const clearAllButton = screen.getByText('Clear All');
    fireEvent.click(clearAllButton);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('opens file preview when file info is clicked', () => {
    const files = [createMockFileInfo('document.docx', 1024 * 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={true}
      />
    );

    const fileInfo = screen.getByText('document.docx').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.getByText('File Preview')).toBeInTheDocument();
    expect(screen.getByText('Name:')).toBeInTheDocument();
    expect(screen.getByText('Size:')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('closes file preview when close button is clicked', () => {
    const files = [createMockFileInfo('document.docx', 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={true}
      />
    );

    // Open preview
    const fileInfo = screen.getByText('document.docx').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.getByText('File Preview')).toBeInTheDocument();

    // Close preview
    const closeButton = screen.getByLabelText('Close preview');
    fireEvent.click(closeButton);

    expect(screen.queryByText('File Preview')).not.toBeInTheDocument();
  });

  it('closes file preview when overlay is clicked', () => {
    const files = [createMockFileInfo('document.docx', 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={true}
      />
    );

    // Open preview
    const fileInfo = screen.getByText('document.docx').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.getByText('File Preview')).toBeInTheDocument();

    // Click overlay
    const overlay = screen.getByText('File Preview').closest('.file-preview-overlay');
    fireEvent.click(overlay!);

    expect(screen.queryByText('File Preview')).not.toBeInTheDocument();
  });

  it('does not close preview when modal content is clicked', () => {
    const files = [createMockFileInfo('document.docx', 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={true}
      />
    );

    // Open preview
    const fileInfo = screen.getByText('document.docx').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.getByText('File Preview')).toBeInTheDocument();

    // Click modal content
    const modal = screen.getByText('File Preview').closest('.file-preview-modal');
    fireEvent.click(modal!);

    expect(screen.getByText('File Preview')).toBeInTheDocument();
  });

  it('shows error details in preview for invalid files', () => {
    const files = [
      createMockFileInfo('invalid.pdf', 1024, false, 'Unsupported file format')
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={true}
      />
    );

    // Open preview
    const fileInfo = screen.getByText('invalid.pdf').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.getAllByText('Unsupported file format')).toHaveLength(2); // One in list, one in preview
  });

  it('does not open preview when showPreview is false', () => {
    const files = [createMockFileInfo('document.docx', 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
        showPreview={false}
      />
    );

    const fileInfo = screen.getByText('document.docx').closest('.file-info');
    fireEvent.click(fileInfo!);

    expect(screen.queryByText('File Preview')).not.toBeInTheDocument();
  });

  it('formats file sizes correctly', () => {
    const files = [
      createMockFileInfo('small.docx', 512), // 512 Bytes
      createMockFileInfo('medium.docx', 1024), // 1 KB
      createMockFileInfo('large.docx', 1024 * 1024), // 1 MB
      createMockFileInfo('huge.docx', 1024 * 1024 * 1024) // 1 GB
    ];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    expect(screen.getByText(/512 Bytes/)).toBeInTheDocument();
    expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1 MB/)).toBeInTheDocument();
    expect(screen.getByText(/1 GB/)).toBeInTheDocument();
  });

  it('handles files with long names by truncating', () => {
    const longFileName = 'this-is-a-very-long-file-name-that-should-be-truncated-in-the-ui.docx';
    const files = [createMockFileInfo(longFileName, 1024)];

    render(
      <FileList 
        files={files} 
        onRemoveFile={mockOnRemoveFile} 
        onClearAll={mockOnClearAll} 
      />
    );

    const fileNameElement = screen.getByText(longFileName);
    expect(fileNameElement).toHaveClass('file-name');
    // The CSS should handle truncation with text-overflow: ellipsis
  });
});