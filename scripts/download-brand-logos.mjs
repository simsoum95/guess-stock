/**
 * Script pour télécharger les logos de marques depuis des URLs
 * Usage: node scripts/download-brand-logos.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BRANDS_DIR = path.join(__dirname, '..', 'public', 'images', 'brands');

// URLs des logos (à remplir avec les vraies URLs)
const LOGOS = {
  'guess.png': 'https://example.com/guess-logo.png', // À remplacer
  'sam-edelman.png': 'https://example.com/sam-edelman-logo.png', // À remplacer
  'vilebrequin.png': 'https://example.com/vilebrequin-logo.png', // À remplacer
  'dkny.png': 'https://example.com/dkny-logo.png', // À remplacer
  'bayton.png': 'https://example.com/bayton-logo.png', // À remplacer
};

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    client.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        file.close();
        fs.unlinkSync(filepath);
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(err);
    });
  });
}

async function main() {
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(BRANDS_DIR)) {
    fs.mkdirSync(BRANDS_DIR, { recursive: true });
    console.log('✓ Dossier créé:', BRANDS_DIR);
  }

  console.log('Téléchargement des logos...\n');

  for (const [filename, url] of Object.entries(LOGOS)) {
    if (url === 'https://example.com/...') {
      console.log(`⚠ Skippé: ${filename} (URL non définie)`);
      continue;
    }

    const filepath = path.join(BRANDS_DIR, filename);
    
    try {
      console.log(`Téléchargement: ${filename}...`);
      await downloadFile(url, filepath);
      console.log(`✓ Téléchargé: ${filename}\n`);
    } catch (error) {
      console.error(`✗ Erreur pour ${filename}: ${error.message}\n`);
    }
  }

  console.log('Terminé!');
}

main().catch(console.error);

