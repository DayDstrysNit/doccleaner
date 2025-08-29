# DOCX Web Converter

A utility application that converts Microsoft Word DOCX files into clean, web-ready text by stripping unnecessary formatting and preserving only essential content structure.

## Features

- Convert DOCX files to clean HTML, Markdown, or plain text
- Preserve document structure (headings, lists, tables)
- Remove Word-specific formatting
- Batch processing support
- Cross-platform desktop application

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Package application
npm run package

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── components/     # UI components
├── services/       # Business logic services
├── models/         # Data models and interfaces
├── utils/          # Utility functions
└── test/           # Test files
```

## Architecture

The application follows a layered architecture:

- **UI Layer**: React components for user interface
- **Application Layer**: Batch processing and orchestration
- **Service Layer**: Document parsing and format conversion
- **Core Layer**: Data models and utilities

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **React**: User interface library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and development server
- **mammoth.js**: DOCX parsing library
- **Vitest**: Testing framework
