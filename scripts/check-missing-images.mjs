#!/usr/bin/env node
/**
 * Script pour analyser les produits sans images
 * et chercher des correspondances potentielles
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

// Fetch products from production API
async function fetchSheet() {
  try {
    console.log('Fetching products from production API...');
    const res = await fetch('https://gb-guess-stock.vercel.app/api/products');
    const data = await res.json();
    console.log(`  Loaded ${data.length} products from API`);
    return data;
  } catch (e) {
    console.log('Error fetching API:', e.message);
    return [];
  }
}

async function analyze() {
  console.log('📊 ANALYSE: Produits vs Images\n');
  
  // 1. Get all products from sheet
  const products = await fetchSheet();
  console.log('Produits dans Google Sheet:', products.length);
  
  // 2. Get all images from index
  const { data: images } = await supabase
    .from('image_index')
    .select('model_ref, color, filename');
  
  console.log('Images dans index:', images?.length);
  
  // 3. Build image lookup by modelRef
  const imagesByModel = new Map();
  images?.forEach(img => {
    const key = img.model_ref.toUpperCase();
    if (!imagesByModel.has(key)) imagesByModel.set(key, []);
    imagesByModel.get(key).push(img);
  });
  
  console.log('ModelRefs uniques avec images:', imagesByModel.size);
  
  // 4. Check each product
  const withImages = [];
  const withoutImages = [];
  
  for (const prod of products) {
    const modelRef = (prod.modelRef || '').toUpperCase().trim();
    const color = (prod.color || '').toUpperCase().trim();
    const brand = (prod.brand || '').toUpperCase().trim();
    const imageUrl = prod.imageUrl || '';
    
    if (!modelRef) continue;
    
    // Check if product has real image (not default)
    const hasRealImage = imageUrl && !imageUrl.includes('default') && !imageUrl.includes('coming-soon');
    const hasImagesInIndex = imagesByModel.has(modelRef);
    
    if (hasRealImage) {
      withImages.push({ modelRef, color, brand, imageUrl });
    } else {
      withoutImages.push({ modelRef, color, brand, hasImagesInIndex });
    }
  }
  
  console.log('\n✅ Produits AVEC images:', withImages.length);
  console.log('❌ Produits SANS images:', withoutImages.length);
  
  // 5. Show products without images
  console.log('\n=== PRODUITS SANS IMAGES (premiers 50) ===');
  withoutImages.slice(0, 50).forEach((p, i) => {
    const indexStatus = p.hasImagesInIndex ? '✅ IMAGES DANS INDEX' : '❌ Aucune image';
    console.log(`${i+1}. ${p.modelRef} | ${p.color} | ${p.brand} | ${indexStatus}`);
  });
  
  // 6. Check if similar images exist in storage or index
  console.log('\n=== RECHERCHE IMAGES SIMILAIRES ===');
  let foundSimilar = 0;
  
  for (const prod of withoutImages) {
    // Search for partial match in image index
    const partialMatches = [];
    
    for (const [key, imgs] of imagesByModel) {
      // Check various matching strategies
      const prodPrefix = prod.modelRef.substring(0, 6);
      const keyPrefix = key.substring(0, 6);
      
      if (key.includes(prod.modelRef) || prod.modelRef.includes(key)) {
        partialMatches.push({ key, count: imgs.length, sample: imgs[0].filename, type: 'exact-partial' });
      } else if (prodPrefix === keyPrefix) {
        partialMatches.push({ key, count: imgs.length, sample: imgs[0].filename, type: 'prefix' });
      }
    }
    
    if (partialMatches.length > 0) {
      console.log(`\n🔍 ${prod.modelRef} (${prod.color}):`);
      console.log('   Images similaires trouvées:');
      partialMatches.slice(0, 5).forEach(m => {
        console.log(`   - ${m.key} (${m.count} imgs) [${m.type}] ex: ${m.sample}`);
      });
      foundSimilar++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(60));
  console.log(`Total produits:              ${products.length}`);
  console.log(`Produits avec images:        ${withImages.length}`);
  console.log(`Produits SANS images:        ${withoutImages.length}`);
  console.log(`Produits avec match partiel: ${foundSimilar}`);
  console.log('='.repeat(60));
}

analyze().catch(console.error);

