#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const webDistPath = path.join(__dirname, '..', 'dist', 'web');
const requiredFiles = [
  'index.html',
  'assets'
];

console.log('🔍 Verifying web build...');

// Check if dist/web directory exists
if (!fs.existsSync(webDistPath)) {
  console.error('❌ Web build directory not found:', webDistPath);
  process.exit(1);
}

// Check required files
for (const file of requiredFiles) {
  const filePath = path.join(webDistPath, file);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Required file/directory not found:', file);
    process.exit(1);
  }
  console.log('✅', file);
}

// Check index.html content
const indexPath = path.join(webDistPath, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

if (!indexContent.includes('DOCX Web Converter')) {
  console.error('❌ index.html missing expected title');
  process.exit(1);
}

if (!indexContent.includes('src=')) {
  console.error('❌ index.html missing script references');
  process.exit(1);
}

console.log('✅ index.html content verified');

// Check assets directory
const assetsPath = path.join(webDistPath, 'assets');
const assets = fs.readdirSync(assetsPath);

const hasJS = assets.some(file => file.endsWith('.js'));
const hasCSS = assets.some(file => file.endsWith('.css'));

if (!hasJS) {
  console.error('❌ No JavaScript files found in assets');
  process.exit(1);
}

if (!hasCSS) {
  console.error('❌ No CSS files found in assets');
  process.exit(1);
}

console.log('✅ Assets directory verified');
console.log('✅ Web build verification complete!');
console.log('');
console.log('📦 Build summary:');
console.log(`   Location: ${webDistPath}`);
console.log(`   Assets: ${assets.length} files`);
console.log(`   Size: ${getDirectorySize(webDistPath)} KB`);

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        calculateSize(path.join(currentPath, file));
      });
    } else {
      totalSize += stats.size;
    }
  }
  
  calculateSize(dirPath);
  return Math.round(totalSize / 1024);
}