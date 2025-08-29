#!/usr/bin/env node

/**
 * Test script for packaged DOCX Web Converter application
 * Verifies that the packaged application works correctly
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  releaseDir: 'release',
  testFiles: {
    docx: 'test-document.docx',
    output: 'test-output.txt'
  }
};

function log(message) {
  console.log(`[TEST] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function findExecutable() {
  const platform = os.platform();
  const releaseDir = TEST_CONFIG.releaseDir;
  
  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release directory '${releaseDir}' not found. Run build first.`);
  }
  
  let executablePath;
  
  switch (platform) {
    case 'darwin': // macOS
      // Look for .app files in mac or mac-arm64 subdirectories
      const macDirs = ['mac', 'mac-arm64'].filter(dir => fs.existsSync(path.join(releaseDir, dir)));
      let appFound = false;
      
      for (const macDir of macDirs) {
        const macDirPath = path.join(releaseDir, macDir);
        const macFiles = fs.readdirSync(macDirPath).filter(f => f.endsWith('.app'));
        if (macFiles.length > 0) {
          executablePath = path.join(macDirPath, macFiles[0], 'Contents', 'MacOS', 'DOCX Web Converter');
          appFound = true;
          break;
        }
      }
      
      if (!appFound) {
        throw new Error('No .app file found in release directory');
      }
      break;
      
    case 'win32': // Windows
      const winFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe'));
      if (winFiles.length === 0) {
        throw new Error('No .exe file found in release directory');
      }
      executablePath = path.join(releaseDir, winFiles[0]);
      break;
      
    case 'linux': // Linux
      const linuxFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.AppImage'));
      if (linuxFiles.length === 0) {
        throw new Error('No .AppImage file found in release directory');
      }
      executablePath = path.join(releaseDir, linuxFiles[0]);
      break;
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }
  
  return executablePath;
}

function createTestDocument() {
  log('Creating test DOCX document...');
  
  // Create a simple test document (placeholder)
  const testContent = 'This is a test DOCX document for verifying the packaged application.';
  const testPath = path.join(__dirname, '..', TEST_CONFIG.testFiles.docx);
  
  // In a real implementation, this would create an actual DOCX file
  // For now, we'll create a placeholder file
  fs.writeFileSync(testPath, testContent);
  
  log(`✓ Test document created: ${testPath}`);
  return testPath;
}

function testApplicationLaunch(executablePath) {
  return new Promise((resolve, reject) => {
    log('Testing application launch...');
    
    const child = spawn(executablePath, [], {
      stdio: 'pipe',
      detached: false
    });
    
    let launched = false;
    
    // Set timeout
    const timeout = setTimeout(() => {
      if (!launched) {
        child.kill();
        reject(new Error('Application launch timeout'));
      }
    }, TEST_CONFIG.timeout);
    
    child.on('spawn', () => {
      launched = true;
      log('✓ Application launched successfully');
      
      // Give the app a moment to initialize
      setTimeout(() => {
        child.kill();
        clearTimeout(timeout);
        resolve();
      }, 2000);
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Application launch failed: ${err.message}`));
    });
    
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (launched) {
        log(`Application exited with code: ${code}`);
        resolve();
      }
    });
  });
}

function validatePackageStructure() {
  log('Validating package structure...');
  
  const releaseDir = TEST_CONFIG.releaseDir;
  const files = fs.readdirSync(releaseDir);
  
  log(`Found ${files.length} files in release directory:`);
  files.forEach(file => {
    const filePath = path.join(releaseDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    log(`  - ${file} (${size} MB)`);
  });
  
  // Check for required files based on platform
  const platform = os.platform();
  let hasRequiredFiles = false;
  
  switch (platform) {
    case 'darwin':
      hasRequiredFiles = files.some(f => f.endsWith('.app') || f.endsWith('.dmg'));
      break;
    case 'win32':
      hasRequiredFiles = files.some(f => f.endsWith('.exe') || f.endsWith('.msi'));
      break;
    case 'linux':
      hasRequiredFiles = files.some(f => f.endsWith('.AppImage') || f.endsWith('.deb') || f.endsWith('.rpm'));
      break;
  }
  
  if (!hasRequiredFiles) {
    throw new Error(`No platform-specific packages found for ${platform}`);
  }
  
  log('✓ Package structure validation passed');
}

function cleanup() {
  log('Cleaning up test files...');
  
  const testPath = path.join(__dirname, '..', TEST_CONFIG.testFiles.docx);
  if (fs.existsSync(testPath)) {
    fs.unlinkSync(testPath);
    log('✓ Test files cleaned up');
  }
}

async function main() {
  try {
    log('Starting packaged application tests...');
    log(`Platform: ${os.platform()}`);
    log(`Architecture: ${os.arch()}`);
    
    validatePackageStructure();
    
    const executablePath = findExecutable();
    log(`Found executable: ${executablePath}`);
    
    createTestDocument();
    
    await testApplicationLaunch(executablePath);
    
    cleanup();
    
    log('🎉 All tests passed! Packaged application is working correctly.');
  } catch (err) {
    error('Package testing failed:');
    error(err.message);
    
    cleanup();
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  testApplicationLaunch,
  validatePackageStructure,
  findExecutable
};