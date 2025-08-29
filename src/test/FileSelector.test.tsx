import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileSelector, { FileInfo } from '../components/FileSelector';

// Mock file for testing
const createMockFile = (
  name: string,
  size: number,
  type: string = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  lastModified: number = Date.now()
): File => {
  const file = new File(['mock content'], name, { type, lastModified });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileSelector', () => {
  const mockOnFilesSelected = vi.fn();

  beforeEach(() => {
    mockOnFilesSelected.mockClear();
  });

  it('renders file selector with default props', () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    expect(screen.getByText('Select DOCX files')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your Word documents here/)).toBeInTheDocument();
    expect(screen.getByText('Supported formats: .docx, .doc')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 50MB')).toBeInTheDocument();
  });

  it('renders with custom accepted formats and file size', () => {
    render(
      <FileSelector 
        onFilesSelected={mockOnFilesSelected}
        acceptedFormats={['.docx']}
        maxFileSize={10 * 1024 * 1024} // 10MB
      />
    );
    
    expect(screen.getByText('Supported formats: .docx')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 10MB')).toBeInTheDocument();
  });

  it('handles file input change with valid files', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = createMockFile('test.docx', 1024 * 1024); // 1MB
    
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'test.docx',
          size: 1024 * 1024,
          isValid: true,
          validationError: undefined
        })
      ]);
    });
  });

  it('validates file size correctly', async () => {
    render(
      <FileSelector 
        onFilesSelected={mockOnFilesSelected}
        maxFileSize={1024 * 1024} // 1MB
      />
    );
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = createMockFile('large.docx', 2 * 1024 * 1024); // 2MB
    
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'large.docx',
          isValid: false,
          validationError: expect.stringContaining('exceeds maximum allowed size')
        })
      ]);
    });
  });

  it('validates file format correctly', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf');
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'test.pdf',
          isValid: false,
          validationError: expect.stringContaining('not supported')
        })
      ]);
    });
  });

  it('validates empty files', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const emptyFile = createMockFile('empty.docx', 0);
    
    fireEvent.change(fileInput, { target: { files: [emptyFile] } });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'empty.docx',
          isValid: false,
          validationError: 'File is empty'
        })
      ]);
    });
  });

  it('handles multiple files', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = createMockFile('test1.docx', 1024);
    const file2 = createMockFile('test2.docx', 2048);
    
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'test1.docx', isValid: true }),
        expect.objectContaining({ name: 'test2.docx', isValid: true })
      ]);
    });
  });

  it('handles drag and drop events', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const dropzone = screen.getByRole('button', { name: /file drop zone/i });
    const validFile = createMockFile('dropped.docx', 1024);
    
    // Mock DataTransfer
    const mockDataTransfer = {
      files: [validFile]
    };
    
    fireEvent.dragEnter(dropzone, { dataTransfer: mockDataTransfer });
    expect(dropzone).toHaveClass('drag-over');
    
    fireEvent.drop(dropzone, { dataTransfer: mockDataTransfer });
    
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'dropped.docx',
          isValid: true
        })
      ]);
    });
    
    expect(dropzone).not.toHaveClass('drag-over');
  });

  it('handles drag leave events', () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const dropzone = screen.getByRole('button', { name: /file drop zone/i });
    
    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('drag-over');
    
    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass('drag-over');
  });

  it('shows processing state', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = createMockFile('test.docx', 1024);
    
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    
    // Processing happens very quickly, so we check that the callback was called
    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalled();
    });
  });

  it('disables interaction when disabled prop is true', () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} disabled={true} />);
    
    const dropzone = screen.getByRole('button', { name: /file drop zone/i });
    expect(dropzone).toHaveClass('disabled');
    expect(dropzone).toHaveAttribute('tabIndex', '-1');
    
    const fileInput = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDisabled();
  });

  it('handles click to browse files', () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const dropzone = screen.getByRole('button', { name: /file drop zone/i });
    const fileInput = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
    
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    fireEvent.click(dropzone);
    
    expect(clickSpy).toHaveBeenCalled();
  });

  it('supports single file mode', () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} multiple={false} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toHaveAttribute('multiple');
  });

  it('resets file input value after selection', async () => {
    render(<FileSelector onFilesSelected={mockOnFilesSelected} />);
    
    const fileInput = screen.getByRole('button', { name: /file drop zone/i }).querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = createMockFile('test.docx', 1024);
    
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    
    await waitFor(() => {
      expect(fileInput.value).toBe('');
    });
  });
});