# Build and Distribution Guide

This document provides comprehensive instructions for building and packaging the DOCX Web Converter application for cross-platform distribution.

## Prerequisites

Before building the application, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (v8 or higher)
- **Python** (for native dependencies)
- **Platform-specific tools:**
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools or Visual Studio Community
  - **Linux**: build-essential package

## Quick Start

```bash
# Install dependencies
npm install

# Build and package for current platform
npm run package

# Build and package for all platforms
npm run package:all
```

## Build Scripts

### Basic Build Commands

- `npm run build` - Build the application (React + Electron)
- `npm run build:react` - Build only the React frontend
- `npm run build:electron` - Build only the Electron main process

### Packaging Commands

- `npm run package` - Package for current platform
- `npm run package:mac` - Package for macOS
- `npm run package:win` - Package for Windows
- `npm run package:linux` - Package for Linux
- `npm run package:all` - Package for all platforms

### Distribution Commands

- `npm run dist` - Create distribution packages for current platform
- `npm run dist:mac` - Create macOS distribution packages
- `npm run dist:win` - Create Windows distribution packages
- `npm run dist:linux` - Create Linux distribution packages

### Advanced Build Scripts

- `npm run build:script` - Use custom build script for current platform
- `npm run build:script:all` - Use custom build script for all platforms
- `npm run test:package` - Test the packaged application

## Platform-Specific Builds

### macOS

**Output formats:**
- `.app` - Application bundle
- `.dmg` - Disk image installer
- `.zip` - Compressed archive

**Requirements:**
- macOS 10.13 or higher
- Code signing certificate (for distribution)

**Build command:**
```bash
npm run package:mac
```

### Windows

**Output formats:**
- `.exe` - Executable installer (NSIS)
- `.exe` - Portable executable
- `.msi` - Windows Installer (optional)

**Requirements:**
- Windows 7 or higher
- Code signing certificate (for distribution)

**Build command:**
```bash
npm run package:win
```

### Linux

**Output formats:**
- `.AppImage` - Universal Linux package
- `.deb` - Debian/Ubuntu package
- `.rpm` - Red Hat/Fedora package

**Requirements:**
- Linux with glibc 2.17 or higher
- Desktop environment with file associations

**Build command:**
```bash
npm run package:linux
```

## Build Configuration

The build process is configured through several files:

### package.json

Contains the main electron-builder configuration:

```json
{
  "build": {
    "appId": "com.docxwebconverter.app",
    "productName": "DOCX Web Converter",
    "directories": {
      "output": "release",
      "buildResources": "assets"
    }
  }
}
```

### Assets Directory

The `assets/` directory contains:

- `icon.png` - Main application icon (512x512)
- `icon.ico` - Windows icon file
- `icon.icns` - macOS icon file
- `dmg-background.png` - macOS DMG background
- `entitlements.mac.plist` - macOS entitlements

### Build Scripts

Custom build scripts in `scripts/`:

- `build.js` - Main build orchestration script
- `test-package.js` - Package testing script

## Environment Variables

You can customize the build process using environment variables:

- `BUILD_NUMBER` - Build version number
- `CSC_LINK` - Code signing certificate path
- `CSC_KEY_PASSWORD` - Certificate password
- `GH_TOKEN` - GitHub token for publishing

## Code Signing

### macOS Code Signing

1. Obtain a Developer ID certificate from Apple
2. Set environment variables:
   ```bash
   export CSC_LINK="path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate_password"
   ```
3. Build with signing:
   ```bash
   npm run package:mac
   ```

### Windows Code Signing

1. Obtain a code signing certificate
2. Set environment variables:
   ```bash
   export CSC_LINK="path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate_password"
   ```
3. Build with signing:
   ```bash
   npm run package:win
   ```

## Testing Packaged Applications

After building, test the packaged application:

```bash
# Test the packaged application
npm run test:package
```

This will:
- Validate package structure
- Launch the application
- Verify basic functionality
- Clean up test files

## Troubleshooting

### Common Issues

1. **Native dependencies fail to build**
   - Ensure you have the correct build tools installed
   - Try rebuilding node modules: `npm rebuild`

2. **Code signing fails**
   - Verify certificate is valid and not expired
   - Check certificate password is correct
   - Ensure certificate has proper permissions

3. **Large package size**
   - Review included files in `package.json` build configuration
   - Exclude unnecessary files and directories
   - Use `npm prune --production` before building

4. **Application won't launch**
   - Check console for error messages
   - Verify all dependencies are included
   - Test on clean system without development tools

### Build Logs

Build logs are available in:
- Console output during build process
- `release/` directory for output files
- System logs for application launch issues

## Distribution

### GitHub Releases

To publish releases to GitHub:

1. Set up GitHub token:
   ```bash
   export GH_TOKEN="your_github_token"
   ```

2. Update version in package.json

3. Build and publish:
   ```bash
   npm run dist:all
   ```

### Manual Distribution

1. Build packages: `npm run package:all`
2. Find output files in `release/` directory
3. Upload to your preferred distribution platform

## Performance Optimization

### Build Performance

- Use `--parallel` flag for multi-platform builds
- Enable build caching where possible
- Use faster storage (SSD) for build directory

### Package Size Optimization

- Exclude development dependencies
- Use `asar` packaging (enabled by default)
- Compress resources where possible
- Remove unused assets and files

## Security Considerations

- Always sign packages for distribution
- Verify package integrity after building
- Use secure channels for certificate storage
- Regularly update dependencies for security patches

## Support

For build-related issues:

1. Check this documentation
2. Review electron-builder documentation
3. Check GitHub issues for similar problems
4. Create detailed bug reports with build logs