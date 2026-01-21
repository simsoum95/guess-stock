#!/usr/bin/env node
/**
 * Vérifie les produits sans images EN UTILISANT LA MÊME LOGIQUE QUE LE SITE
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Color map from fetchProducts.ts
const COLOR_MAP = {
  "BLACK": ["BLK", "BLCK", "BLACK", "NERO", "NER", "BLA", "NBK", "001"],
  "BLK": ["BLACK", "BLCK", "NERO", "NER", "BLA", "NBK", "001"],
  "WHITE": ["WHT", "WH", "WHITE", "BIANCO", "BIA", "WHI", "140", "145"],
  "WHI": ["WHITE", "WHT", "WH", "BIANCO", "BIA", "140", "145"],
  "BROWN": ["BRN", "BROWN", "MARRONE", "MAR", "DBR", "TAN", "200", "210"],
  "BRN": ["BROWN", "MARRONE", "MAR", "DBR", "TAN", "200", "210"],
  "DBR": ["DARK BROWN", "DARKBROWN", "BROWN", "MARRONE", "200", "210"],
  "BEIGE": ["BEI", "BEIGE", "BGE"],
  "BGE": ["BEIGE", "BEI"],
  "PINK": ["PNK", "PINK", "ROSA", "ROS"],
  "PNK": ["PINK", "ROSA", "ROS"],
  "RED": ["RD", "RED", "ROSSO", "ROS"],
  "BLUE": ["BLU", "BLUE", "AZZURRO", "AZZ", "MBL"],
  "BLU": ["BLUE", "AZZURRO", "AZZ", "MBL"],
  "MBL": ["MEDIUM BLUE", "BLUE", "BLU"],
  "GOLD": ["GLD", "GOLD", "ORO", "GOL"],
  "GOL": ["GOLD", "GLD", "ORO"],
  "SILVER": ["SLV", "SILVER", "ARGENTO", "ARG", "SIL"],
  "SIL": ["SILVER", "SLV", "ARGENTO"],
  "NATURAL": ["NAT", "NATURAL", "NATURALE", "LNA"],
  "LNA": ["LIGHT NATURAL", "NATURAL", "NAT"],
  "GREY": ["GRY", "GREY", "GRAY", "GRIGIO", "GRI"],
  "GRY": ["GREY", "GRAY", "GRIGIO"],
  "NAVY": ["NVY", "NAVY", "BLU NAVY"],
  "NVY": ["NAVY", "BLU NAVY"],
  "GREEN": ["GRN", "GREEN", "VERDE", "VER"],
  "CAMEL": ["CML", "CAMEL", "CAMMELLO"],
  "CREAM": ["CRM", "CREAM", "CREMA", "CRE"],
  "CRE": ["CREAM", "CRM", "CREMA"],
  "ORANGE": ["ORG", "ORANGE", "ARANCIONE"],
  "PURPLE": ["PRP", "PURPLE", "VIOLA", "VIO"],
  "YELLOW": ["YLW", "YELLOW", "GIALLO"],
  "NUDE": ["NDE", "NUDE"],
  "IVORY": ["IVY", "IVORY", "AVORIO"],
  "COGNAC": ["COG", "COGNAC"],
  "DRE": ["DRESS"],
};

function parseColorCode(color) {
  const match = color.match(/^([A-Z]+)(\d*)$/);
  if (match) {
    return { base: match[1], number: match[2] };
  }
  return { base: color, number: "" };
}

function matchesColor(imageColor, productColor) {
  const imgColorUpper = imageColor.toUpperCase().trim();
  const prodColorUpper = productColor.toUpperCase().trim();

  if (imgColorUpper === prodColorUpper) return true;

  const cleanColor = (c) => c.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");

  const imgNormalized = cleanColor(imgColorUpper);
  const prodNormalized = cleanColor(prodColorUpper);

  if (imgNormalized === prodNormalized) return true;

  const isColorEquivalent = (color1, color2) => {
    const mappedColors = COLOR_MAP[color1];
    if (mappedColors) {
      for (const mapped of mappedColors) {
        const mappedNorm = cleanColor(mapped);
        if (mappedNorm === color2) return true;
      }
    }
    return false;
  };

  if (isColorEquivalent(imgNormalized, prodNormalized)) return true;
  if (isColorEquivalent(prodNormalized, imgNormalized)) return true;

  const imgParts = parseColorCode(imgNormalized);
  const prodParts = parseColorCode(prodNormalized);

  if (imgParts.number && prodParts.number && imgParts.number !== prodParts.number) {
    return false;
  }

  if (isColorEquivalent(imgParts.base, prodParts.base)) return true;

  if (imgParts.base.length <= 4 && prodParts.base.length > imgParts.base.length) {
    if (prodParts.base.includes(imgParts.base)) return true;
  }
  if (prodParts.base.length <= 4 && imgParts.base.length > prodParts.base.length) {
    if (imgParts.base.includes(prodParts.base)) return true;
  }

  if (imgParts.base.length >= 2 && imgParts.base.length <= 4) {
    if (prodParts.base.startsWith(imgParts.base) || prodNormalized.includes(imgParts.base)) {
      return true;
    }
  }
  if (prodParts.base.length >= 2 && prodParts.base.length <= 4) {
    if (imgParts.base.startsWith(prodParts.base) || imgNormalized.includes(prodParts.base)) {
      return true;
    }
  }

  return false;
}

async function fetchSheet(name) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(name)}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.values || data.values.length < 2) return [];
  const headers = data.values[0];
  return data.values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

async function main() {
  console.log('═'.repeat(70));
  console.log('   VÉRIFICATION DES PRODUITS SANS IMAGES - LOGIQUE IDENTIQUE AU SITE');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Load ALL images from image_index (comme le site)
  console.log('1. Chargement des images depuis image_index...');
  let allImages = [];
  let off = 0;
  while (true) {
    const { data } = await supabase
      .from('image_index')
      .select('model_ref, color, url')
      .range(off, off + 999);
    if (!data || !data.length) break;
    allImages.push(...data);
    off += 1000;
  }
  
  // Build image map: modelRef -> [{color, url}]
  const imagesByModelRef = new Map();
  for (const img of allImages) {
    const modelRef = img.model_ref.toUpperCase().trim();
    if (!imagesByModelRef.has(modelRef)) {
      imagesByModelRef.set(modelRef, []);
    }
    imagesByModelRef.get(modelRef).push({
      color: img.color.toUpperCase().trim(),
      url: img.url
    });
  }
  
  console.log(`   Total images: ${allImages.length}`);
  console.log(`   ModelRefs avec images: ${imagesByModelRef.size}`);
  console.log('');

  // 2. Load products from Google Sheets
  console.log('2. Chargement des produits depuis Google Sheets...');
  const sheets = [
    { name: 'תיקים', brand: 'GUESS' },
    { name: 'נעליים', brand: 'GUESS' },
    { name: 'נעליים SAM', brand: 'SAM EDELMAN' },
    { name: 'VILEBREQUIN', brand: 'VILEBREQUIN' }
  ];
  
  const allProducts = [];
  for (const sheet of sheets) {
    try {
      const rows = await fetchSheet(sheet.name);
      for (const row of rows) {
        const itemCode = row['קוד פריט'] || '';
        if (!itemCode) continue;
        
        const parts = itemCode.split('-');
        const modelRef = parts[0].toUpperCase().trim();
        const colorFromCode = parts[1]?.toUpperCase().trim() || '';
        const color = (row['צבע'] || colorFromCode).toUpperCase().trim();
        
        if (modelRef.length >= 2) {
          allProducts.push({
            modelRef,
            color,
            itemCode,
            name: row['שם פריט'] || row['שם תיק'] || modelRef,
            sheet: sheet.name,
            brand: sheet.brand
          });
        }
      }
      console.log(`   ${sheet.name}: ${rows.length} lignes`);
    } catch (e) {
      console.log(`   ${sheet.name}: ERREUR - ${e.message}`);
    }
  }
  console.log(`   TOTAL: ${allProducts.length} produits`);
  console.log('');

  // 3. Match products with images (SAME LOGIC AS SITE)
  console.log('3. Matching produits ↔ images...');
  const withImages = [];
  const withoutImages = [];

  for (const product of allProducts) {
    const modelRefImages = imagesByModelRef.get(product.modelRef);
    let hasImage = false;

    if (modelRefImages && modelRefImages.length > 0) {
      // Try to find exact color match or use matchesColor
      for (const img of modelRefImages) {
        if (img.color === product.color || matchesColor(img.color, product.color)) {
          hasImage = true;
          break;
        }
      }
      
      // Si pas de match exact, utiliser n'importe quelle image du modelRef
      if (!hasImage && modelRefImages.length > 0) {
        hasImage = true; // Le site fait pareil - fallback sur une image du même modelRef
      }
    }

    if (hasImage) {
      withImages.push(product);
    } else {
      withoutImages.push(product);
    }
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('   RÉSULTATS');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`   TOTAL PRODUITS: ${allProducts.length}`);
  console.log(`   ✅ Avec images:  ${withImages.length} (${((withImages.length/allProducts.length)*100).toFixed(1)}%)`);
  console.log(`   ❌ Sans images:  ${withoutImages.length} (${((withoutImages.length/allProducts.length)*100).toFixed(1)}%)`);
  console.log('');

  // Par feuille
  console.log('   Détail par feuille:');
  for (const sheet of sheets) {
    const sheetProducts = allProducts.filter(p => p.sheet === sheet.name);
    const sheetWithout = withoutImages.filter(p => p.sheet === sheet.name);
    console.log(`   • ${sheet.name}: ${sheetProducts.length - sheetWithout.length}/${sheetProducts.length} avec images`);
  }
  console.log('');

  // Liste des produits sans images
  if (withoutImages.length > 0) {
    console.log('═'.repeat(70));
    console.log('   LISTE DES PRODUITS SANS IMAGES');
    console.log('═'.repeat(70));
    console.log('');
    
    // Grouper par feuille
    for (const sheet of sheets) {
      const sheetWithout = withoutImages.filter(p => p.sheet === sheet.name);
      if (sheetWithout.length === 0) continue;
      
      console.log(`\n--- ${sheet.name} (${sheetWithout.length}) ---`);
      sheetWithout.forEach((p, i) => {
        console.log(`${i + 1}. ${p.modelRef} | ${p.color} | ${p.name}`);
      });
    }
  }

  console.log('');
  console.log('═'.repeat(70));
}

main().catch(console.error);

