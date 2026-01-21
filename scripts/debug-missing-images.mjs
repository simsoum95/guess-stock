#!/usr/bin/env node
/**
 * ANALYSE UNIQUEMENT - Ne modifie rien
 * Vérifie pourquoi certains produits n'ont pas d'images
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Fetch all sheet names
async function getSheetNames() {
  if (!GOOGLE_API_KEY) {
    return ['final test', 'תיקים', 'נעליים'];
  }
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.sheets?.map(s => s.properties.title) || [];
  } catch (e) {
    return ['final test', 'תיקים', 'נעליים'];
  }
}

// Parse CSV line handling quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Fetch products from CSV export
async function fetchAllProducts() {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
  try {
    const res = await fetch(csvUrl);
    const text = await res.text();
    
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]);
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => obj[h] = values[idx] || '');
      products.push(obj);
    }
    
    return products;
  } catch (e) {
    console.log('Erreur CSV:', e.message);
    return [];
  }
}

// Get all images from index
async function getAllImages() {
  let allImages = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('image_index')
      .select('model_ref, color, filename')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allImages.push(...data);
    offset += 1000;
  }
  return allImages;
}

// Main analysis
async function analyze() {
  console.log('═'.repeat(70));
  console.log('   ANALYSE DES PRODUITS SANS IMAGES - LECTURE SEULE');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Get all products from Google Sheets (CSV export)
  console.log('1. Chargement des produits depuis Google Sheets (CSV)...');
  const allProducts = await fetchAllProducts();
  console.log(`   TOTAL: ${allProducts.length} produits\n`);

  // 2. Get all images from index
  console.log('2. Chargement des images depuis index...');
  const allImages = await getAllImages();
  console.log(`   TOTAL: ${allImages.length} images\n`);

  // 3. Build image lookup
  const imagesByModelRef = new Map();
  allImages.forEach(img => {
    const key = img.model_ref.toUpperCase().trim();
    if (!imagesByModelRef.has(key)) {
      imagesByModelRef.set(key, []);
    }
    imagesByModelRef.get(key).push({
      color: img.color,
      filename: img.filename
    });
  });
  console.log(`   ModelRefs uniques avec images: ${imagesByModelRef.size}\n`);

  // 4. Check each product
  console.log('3. Analyse des correspondances...\n');
  
  const withImages = [];
  const withoutImages = [];
  const withPotentialMatch = [];

  for (const prod of allProducts) {
    // Get modelRef from product - extract from 'קוד פריט' (e.g., "QL9658983-BLA-OS" -> "QL9658983")
    const itemCode = (prod['קוד פריט'] || '').toUpperCase().trim();
    const modelRef = itemCode.split('-')[0]; // Take first part before dash
    const color = (prod['צבע'] || prod['color'] || '').toUpperCase().trim();
    const productName = prod['תיאור דגם'] || prod['שם המוצר'] || '';
    
    if (!modelRef) continue;

    // Check if we have images for this modelRef
    const imagesForModel = imagesByModelRef.get(modelRef);
    
    if (imagesForModel && imagesForModel.length > 0) {
      withImages.push({ modelRef, color, productName, imageCount: imagesForModel.length });
    } else {
      // No direct match - check for similar modelRefs
      const similarModels = [];
      for (const [key, imgs] of imagesByModelRef) {
        // Check if modelRef is similar
        if (key.includes(modelRef) || modelRef.includes(key)) {
          similarModels.push({ key, count: imgs.length, sample: imgs[0].filename });
        } else if (modelRef.length > 4 && key.startsWith(modelRef.substring(0, 5))) {
          similarModels.push({ key, count: imgs.length, sample: imgs[0].filename });
        }
      }
      
      if (similarModels.length > 0) {
        withPotentialMatch.push({ modelRef, color, productName, similar: similarModels });
      } else {
        withoutImages.push({ modelRef, color, productName });
      }
    }
  }

  // 5. Results
  console.log('═'.repeat(70));
  console.log('   RÉSULTATS');
  console.log('═'.repeat(70));
  console.log(`\n✅ Produits AVEC images:              ${withImages.length}`);
  console.log(`🔍 Produits avec CORRESPONDANCE POTENTIELLE: ${withPotentialMatch.length}`);
  console.log(`❌ Produits SANS images:              ${withoutImages.length}`);
  console.log('');

  // Show potential matches (images exist but name is different)
  if (withPotentialMatch.length > 0) {
    console.log('═'.repeat(70));
    console.log('   CORRESPONDANCES POTENTIELLES - Images existent mais nom différent');
    console.log('═'.repeat(70));
    withPotentialMatch.slice(0, 30).forEach((p, i) => {
      console.log(`\n${i+1}. ${p.modelRef} (${p.color}) - ${p.productName || 'N/A'}`);
      console.log('   Images similaires trouvées:');
      p.similar.slice(0, 3).forEach(s => {
        console.log(`      → ${s.key} (${s.count} images) ex: ${s.sample}`);
      });
    });
  }

  // Show products without any images
  if (withoutImages.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('   PRODUITS SANS AUCUNE IMAGE (premiers 50)');
    console.log('═'.repeat(70));
    withoutImages.slice(0, 50).forEach((p, i) => {
      console.log(`${i+1}. ${p.modelRef} | ${p.color} | ${p.productName || 'N/A'}`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('   FIN DE L\'ANALYSE');
  console.log('═'.repeat(70));
}

analyze().catch(console.error);

