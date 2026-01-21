import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\1\\.cursor\\browser-logs\\snapshot-2026-01-21T12-39-21-625Z.log', 'utf-8');

// Find all folder names
const lines = content.split('\n');
const folderNames = [];

for (const line of lines) {
  // Match lines like: name: FOLDER_NAME הבעלים
  const match = line.match(/name: ([A-Z][A-Z0-9 ]+[A-Z0-9])\s/);
  if (match && !match[1].includes('GUESS') && !match[1].includes('PRODUCT') && match[1].length > 3) {
    folderNames.push(match[1].trim());
  }
}

const unique = [...new Set(folderNames)].sort();
console.log('Dossiers dans 262 Product Images:');
unique.forEach(name => console.log(' -', name));
console.log('\nTotal:', unique.length, 'dossiers');

