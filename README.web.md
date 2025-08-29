# DOCX Web Converter

A browser-based application that converts Microsoft Word DOCX files into clean, web-ready text formats including HTML, Markdown, and plain text.

## Features

- **Drag & Drop Interface**: Simply drag DOCX files into the browser
- **Multiple Output Formats**: Convert to HTML, Markdown, or plain text
- **Batch Processing**: Process multiple files at once
- **Real-time Preview**: See converted content before downloading
- **Browser-based**: No installation required, works entirely in your browser
- **Privacy-focused**: All processing happens locally in your browser

## How to Use

1. **Select Files**: Drag and drop DOCX files or click to browse
2. **Choose Options**: Select output format and processing preferences
3. **Process**: Click "Process Files" to convert your documents
4. **Download**: Preview and download your converted files

## Supported Formats

- **Input**: Microsoft Word DOCX files
- **Output**: HTML, Markdown, Plain Text

## Technical Details

- Built with React and TypeScript
- Uses mammoth.js for DOCX processing
- Deployed on GitHub Pages
- No server-side processing required

## Development

### Web Development
```bash
npm run dev:web          # Start development server
npm run build:web        # Build for production
npm run preview:web      # Preview production build
```

### Electron Development (Legacy)
```bash
npm run dev              # Start Electron app
npm run build            # Build Electron app
npm run package          # Package Electron app
```

## Deployment

The web version is automatically deployed to GitHub Pages when changes are pushed to the main branch.

## Privacy & Security

- All file processing happens locally in your browser
- No files are uploaded to any server
- No data is stored or transmitted
- Works completely offline after initial load

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

MIT License - see LICENSE file for details