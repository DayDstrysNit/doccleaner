/**
 * Electron Builder Configuration
 * This file provides additional configuration for the build process
 */

const config = {
  // Extend the package.json build configuration
  extends: null,
  
  // Additional build options
  beforeBuild: async (context) => {
    console.log('Starting build process...');
    console.log(`Building for platform: ${context.platform.name}`);
    console.log(`Architecture: ${context.arch}`);
  },
  
  afterSign: async (context) => {
    console.log('Build completed successfully');
    console.log(`Output files: ${context.outDir}`);
  },
  
  // Compression settings
  compression: 'maximum',
  
  // Remove development dependencies from the final package
  removePackageScripts: true,
  
  // Additional metadata
  buildVersion: process.env.BUILD_NUMBER || '1',
};

module.exports = config;