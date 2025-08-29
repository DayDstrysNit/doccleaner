#!/usr/bin/env node

/**
 * Build script for DOCX Web Converter
 * Handles the complete build and packaging process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Build configuration
const BUILD_CONFIG = {
  platforms: {
    mac: ['--mac'],
    win: ['--win'],
    linux: ['--linux'],
    all: ['--mac', '--win', '--linux']
  },
  outputDir: 'release',
  distDir: 'dist'
};

function log(message) {
  console.log(`[BUILD] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function executeCommand(command, description) {
  log(description);
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✓ ${description} completed`);
  } catch (err) {
    error(`✗ ${description} failed`);
    throw err;
  }
}

function validateEnvironment() {
  log('Validating build environment...');
  
  // Check if required directories exist
  const requiredDirs = ['src', 'assets'];
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Required directory '${dir}' not found`);
    }
  }
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found');
  }
  
  log('✓ Environment validation passed');
}

function cleanBuildDirectories() {
  log('Cleaning build directories...');
  
  const dirsToClean = [BUILD_CONFIG.outputDir, BUILD_CONFIG.distDir];
  
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log(`✓ Cleaned ${dir}`);
    }
  }
}

function buildApplication() {
  log('Building application...');
  
  // Build React frontend
  executeCommand('npm run build:react', 'Building React frontend');
  
  // Build Electron main process
  executeCommand('npm run build:electron', 'Building Electron main process');
  
  log('✓ Application build completed');
}

function packageApplication(platform = 'current') {
  log(`Packaging application for platform: ${platform}`);
  
  const platformArgs = BUILD_CONFIG.platforms[platform] || [];
  const command = `npx electron-builder ${platformArgs.join(' ')} --publish=never`;
  
  executeCommand(command, `Packaging for ${platform}`);
  
  log('✓ Application packaging completed');
}

function displayBuildSummary() {
  log('Build Summary:');
  
  if (fs.existsSync(BUILD_CONFIG.outputDir)) {
    const files = fs.readdirSync(BUILD_CONFIG.outputDir);
    log(`Output files (${files.length}):`);
    files.forEach(file => {
      const filePath = path.join(BUILD_CONFIG.outputDir, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      log(`  - ${file} (${size} MB)`);
    });
  } else {
    log('No output files found');
  }
}

async function main() {
  const platform = process.argv[2] || 'current';
  
  try {
    log('Starting DOCX Web Converter build process...');
    log(`Target platform: ${platform}`);
    
    validateEnvironment();
    cleanBuildDirectories();
    buildApplication();
    packageApplication(platform);
    displayBuildSummary();
    
    log('🎉 Build process completed successfully!');
  } catch (err) {
    error('Build process failed:');
    error(err.message);
    process.exit(1);
  }
}

// Run the build process
if (require.main === module) {
  main();
}

module.exports = {
  buildApplication,
  packageApplication,
  validateEnvironment
};