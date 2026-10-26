/**
 * TİLTOPİA — Cat Door: Tower Climb
 * build.js — Standalone Bundle Generator
 * Bundles modular src/*.js files into game.js for single-file deployment.
 */

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const srcDir = path.join(baseDir, 'src');

const files = [
  'config.js',
  'audio_data.js',
  'audio.js',
  'haptics.js',
  'particles.js',
  'physics.js',
  'cat.js',
  'door.js',
  'input.js',
  'game.js'
];

let bundleContent = '/** TİLTOPİA — CAT DOOR: TOWER CLIMB (Standalone Bundle) **/\n\n';

for (const file of files) {
  const filePath = path.join(srcDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Missing file ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  bundleContent += `// --- FILE: src/${file} ---\n` + content + '\n\n';
}

const outputPath = path.join(baseDir, 'game.js');
fs.writeFileSync(outputPath, bundleContent, 'utf8');
console.log(`[Tiltopia Build] Successfully generated game.js (${bundleContent.length} bytes)`);
