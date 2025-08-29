# Web Deployment Guide

This guide covers deploying the DOCX Web Converter as a browser-based web application.

## Quick Start

1. **Build for web**: `npm run build:web`
2. **Verify build**: `npm run verify:web`
3. **Deploy**: Push to main branch (auto-deploys to GitHub Pages)

## GitHub Pages Deployment

### Automatic Deployment

The application automatically deploys to GitHub Pages when you push to the main branch:

1. Push changes to main branch
2. GitHub Actions builds the web version
3. Deploys to `https://yourusername.github.io/docx-web-converter/`

### Manual Deployment

If you need to deploy manually:

1. Build the web version:
   ```bash
   npm run build:web
   ```

2. Verify the build:
   ```bash
   npm run verify:web
   ```

3. The built files are in `dist/web/` - upload these to your web server

## Configuration

### Repository Settings

1. Go to your GitHub repository settings
2. Navigate to "Pages" section
3. Set source to "GitHub Actions"
4. The workflow will handle the rest

### Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public/` directory with your domain
2. Configure DNS to point to GitHub Pages
3. Update the `base` URL in `vite.config.web.ts`

## Environment Variables

No environment variables are required for the web deployment. All processing happens client-side.

## Build Optimization

The web build is optimized for:
- Small bundle size (gzipped ~187KB)
- Fast loading
- Offline capability (after first load)
- Modern browser compatibility

## Troubleshooting

### Build Issues

If the build fails:
1. Check Node.js version (requires 16+)
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check for TypeScript errors: `npm run lint`

### Deployment Issues

If GitHub Pages deployment fails:
1. Check the Actions tab for error details
2. Ensure the repository has Pages enabled
3. Verify the workflow has proper permissions

### Runtime Issues

If the app doesn't work in production:
1. Check browser console for errors
2. Verify all assets loaded correctly
3. Test with different browsers
4. Check if files are being served with correct MIME types

## Performance

The web version is optimized for performance:
- Code splitting for faster initial load
- Lazy loading of heavy components
- Efficient mammoth.js integration
- Minimal runtime dependencies

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Security

- All processing happens client-side
- No data sent to servers
- No cookies or tracking
- Content Security Policy headers recommended