#!/usr/bin/env node
/**
 * ANALYSE COMPLETE - Utilise le même code que le site
 * LECTURE SEULE - Aucune modification
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reproduire exactement ce que fait le site
async function getAllSheetNames() {
  if (GOOGLE_API_KEY) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.sheets?.map(s => s.properties.title) || [];
    } catch (e) {
      console.log('API error:', e.message);
    }
  }
  // Fallback
  return ['final test', 'תיקים', 'נעליים', 'נעליים SAM', 'VILEBREQUIN'];
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

async function fetchSheetData(sheetName) {
  // Try API first
  if (GOOGLE_API_KEY) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.values && data.values.length > 1) {
          const headers = data.values[0];
          return data.values.slice(1).map(row => {
            const obj = { _sheet: sheetName };
            headers.forEach((h, i) => obj[h] = row[i] || '');
            return obj;
          });
        }
      }
    } catch (e) {}
  }
  return [];
}

async function main() {
  console.log('═'.repeat(70));
  console.log('   ANALYSE COMPLETE - LECTURE SEULE');
  console.log('═'.repeat(70));
  console.log('');
  console.log('GOOGLE_API_KEY:', GOOGLE_API_KEY ? 'Configuré' : 'NON configuré');
  console.log('');

  // 1. Get all sheet names
  console.log('1. Récupération des feuilles...');
  const sheetNames = await getAllSheetNames();
  console.log(`   Feuilles: ${sheetNames.join(', ')}`);

  // 2. Fetch all products
  console.log('\n2. Chargement des produits...');
  let allProducts = [];
  
  for (const name of sheetNames) {
    const products = await fetchSheetData(name);
    if (products.length > 0) {
      console.log(`   ${name}: ${products.length} produits`);
      allProducts.push(...products);
    }
  }
  
  console.log(`\n   ► TOTAL PRODUITS: ${allProducts.length}`);

  // 3. Get images from Supabase
  console.log('\n3. Chargement des images Supabase...');
  let allImages = [];
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('image_index')
      .select('model_ref, color')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allImages.push(...data);
    offset += 1000;
  }
  
  console.log(`   ► TOTAL IMAGES: ${allImages.length}`);

  // 4. Build lookup
  const imagesByModelRef = new Map();
  allImages.forEach(img => {
    const key = img.model_ref.toUpperCase().trim();
    if (!imagesByModelRef.has(key)) imagesByModelRef.set(key, new Set());
    imagesByModelRef.get(key).add(img.color);
  });
  
  console.log(`   ► ModelRefs avec images: ${imagesByModelRef.size}`);

  // 5. Analyze
  console.log('\n4. Analyse des correspondances...');
  
  let withImages = 0, withoutImages = 0;
  const missing = [];
  const bySheet = {};

  for (const prod of allProducts) {
    const itemCode = (prod['קוד פריט'] || prod['קוד גם'] || '').toUpperCase().trim();
    const modelRef = itemCode.split('-')[0];
    const color = (prod['צבע'] || '').toUpperCase().trim();
    const name = prod['תיאור דגם'] || prod['שם המוצר'] || '';
    const sheet = prod._sheet;

    if (!modelRef || modelRef.length < 2) continue;

    if (!bySheet[sheet]) bySheet[sheet] = { with: 0, without: 0 };

    if (imagesByModelRef.has(modelRef)) {
      withImages++;
      bySheet[sheet].with++;
    } else {
      withoutImages++;
      bySheet[sheet].without++;
      missing.push({ modelRef, itemCode, color, name, sheet });
    }
  }

  // Results
  console.log('\n' + '═'.repeat(70));
  console.log('   RÉSULTATS');
  console.log('═'.repeat(70));
  
  const total = withImages + withoutImages;
  console.log(`\n   TOTAL analysé: ${total} produits`);
  console.log(`   ✅ Avec images:  ${withImages} (${Math.round(withImages/total*100)}%)`);
  console.log(`   ❌ Sans images:  ${withoutImages} (${Math.round(withoutImages/total*100)}%)`);

  console.log('\n   Détail par feuille:');
  for (const [sheet, stats] of Object.entries(bySheet)) {
    const t = stats.with + stats.without;
    console.log(`   • ${sheet}: ${stats.with}/${t} avec images (${Math.round(stats.with/t*100)}%)`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('   PRODUITS SANS IMAGES');
  console.log('═'.repeat(70));
  
  missing.slice(0, 60).forEach((p, i) => {
    console.log(`${String(i+1).padStart(2)}. ${p.modelRef.padEnd(15)} | ${p.color.padEnd(20)} | ${p.name.substring(0,25)} [${p.sheet}]`);
  });

  if (missing.length > 60) {
    console.log(`\n   ... et ${missing.length - 60} autres`);
  }

  console.log('\n' + '═'.repeat(70));
}

main().catch(console.error);
