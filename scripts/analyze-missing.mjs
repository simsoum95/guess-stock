#!/usr/bin/env node
/**
 * Analyse les 411 produits sans images pour voir si les images existent sous d'autres noms
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Force auto-discovery
process.env.GOOGLE_SHEET_NAME = "";

async function main() {
  console.log('═'.repeat(70));
  console.log('   ANALYSE DES IMAGES MANQUANTES');
  console.log('═'.repeat(70));
  console.log('');

  const { fetchProducts } = await import('../lib/fetchProducts.ts');
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Get all products
  console.log('1. Chargement des produits...');
  const products = await fetchProducts();
  const withoutImages = products.filter(p => !p.imageUrl || p.imageUrl.includes('default.png'));
  console.log(`   ${withoutImages.length} produits sans images\n`);

  // 2. Get all images from Supabase
  console.log('2. Chargement des images Supabase...');
  let allImages = [];
  let off = 0;
  while (true) {
    const { data } = await supabase.from('image_index').select('model_ref, color, filename, url').range(off, off + 999);
    if (!data || !data.length) break;
    allImages.push(...data);
    off += 1000;
  }
  console.log(`   ${allImages.length} images dans Supabase\n`);

  // Build index by modelRef
  const imagesByModelRef = new Map();
  const imagesByFilename = new Map();
  for (const img of allImages) {
    const mr = img.model_ref.toUpperCase();
    if (!imagesByModelRef.has(mr)) imagesByModelRef.set(mr, []);
    imagesByModelRef.get(mr).push(img);
    imagesByFilename.set(img.filename.toUpperCase(), img);
  }

  // 3. Analyze each missing product
  console.log('3. Analyse des correspondances potentielles...\n');
  
  const results = {
    exactModelRefDiffColor: [], // ModelRef exact mais couleur différente
    similarModelRef: [],        // ModelRef similaire (préfixe commun)
    partialMatch: [],           // Match partiel dans le nom de fichier
    noMatch: []                 // Aucune correspondance
  };

  for (const product of withoutImages) {
    const modelRef = product.modelRef.toUpperCase();
    const color = product.color.toUpperCase();
    const productName = (product.productName || product.bagName || '').toUpperCase();
    
    let found = false;
    
    // Check 1: Exact modelRef but different color
    if (imagesByModelRef.has(modelRef)) {
      const imgs = imagesByModelRef.get(modelRef);
      results.exactModelRefDiffColor.push({
        product: { modelRef, color, name: productName },
        availableColors: imgs.map(i => i.color),
        sampleImage: imgs[0].filename
      });
      found = true;
      continue;
    }
    
    // Check 2: Similar modelRef (same prefix, different suffix)
    const prefix = modelRef.substring(0, Math.min(6, modelRef.length));
    const similarModels = [];
    for (const [mr, imgs] of imagesByModelRef.entries()) {
      if (mr !== modelRef && mr.startsWith(prefix)) {
        similarModels.push({ modelRef: mr, colors: imgs.map(i => i.color), sample: imgs[0].filename });
      }
    }
    if (similarModels.length > 0) {
      results.similarModelRef.push({
        product: { modelRef, color, name: productName },
        similar: similarModels.slice(0, 5)
      });
      found = true;
      continue;
    }
    
    // Check 3: Product name appears in filename
    if (productName.length > 3) {
      const words = productName.split(/\s+/).filter(w => w.length > 3);
      const matchingFiles = [];
      for (const [filename, img] of imagesByFilename.entries()) {
        for (const word of words) {
          if (filename.includes(word)) {
            matchingFiles.push({ filename: img.filename, modelRef: img.model_ref });
            break;
          }
        }
      }
      if (matchingFiles.length > 0) {
        results.partialMatch.push({
          product: { modelRef, color, name: productName },
          matches: matchingFiles.slice(0, 5)
        });
        found = true;
        continue;
      }
    }
    
    // No match found
    if (!found) {
      results.noMatch.push({ modelRef, color, name: productName });
    }
  }

  // 4. Display results
  console.log('═'.repeat(70));
  console.log('   RÉSULTATS DE L\'ANALYSE');
  console.log('═'.repeat(70));
  console.log('');
  
  // Summary
  console.log('📊 RÉSUMÉ:');
  console.log(`   ✅ ModelRef exact, couleur différente: ${results.exactModelRefDiffColor.length}`);
  console.log(`   🔶 ModelRef similaire trouvé:          ${results.similarModelRef.length}`);
  console.log(`   🔷 Match partiel par nom:              ${results.partialMatch.length}`);
  console.log(`   ❌ Aucune correspondance:              ${results.noMatch.length}`);
  console.log('');

  // Detail: Exact modelRef with different color
  if (results.exactModelRefDiffColor.length > 0) {
    console.log('═'.repeat(70));
    console.log('✅ MODELREF EXACT MAIS COULEUR DIFFÉRENTE');
    console.log('   → Ces produits ont des images mais la couleur ne matche pas');
    console.log('═'.repeat(70));
    results.exactModelRefDiffColor.slice(0, 30).forEach((r, i) => {
      console.log(`${i+1}. ${r.product.modelRef} | Cherche: "${r.product.color}"`);
      console.log(`   Images disponibles: ${r.availableColors.join(', ')}`);
      console.log(`   Fichier: ${r.sampleImage}`);
      console.log('');
    });
    if (results.exactModelRefDiffColor.length > 30) {
      console.log(`   ... et ${results.exactModelRefDiffColor.length - 30} autres\n`);
    }
  }

  // Detail: Similar modelRef
  if (results.similarModelRef.length > 0) {
    console.log('═'.repeat(70));
    console.log('🔶 MODELREF SIMILAIRE TROUVÉ');
    console.log('   → Ces produits ont un modelRef proche mais pas identique');
    console.log('═'.repeat(70));
    results.similarModelRef.slice(0, 20).forEach((r, i) => {
      console.log(`${i+1}. ${r.product.modelRef} (${r.product.color}) - ${r.product.name}`);
      r.similar.forEach(s => {
        console.log(`   → ${s.modelRef} (${s.colors.join(', ')}) - ${s.sample}`);
      });
      console.log('');
    });
    if (results.similarModelRef.length > 20) {
      console.log(`   ... et ${results.similarModelRef.length - 20} autres\n`);
    }
  }

  // Detail: Partial match by name
  if (results.partialMatch.length > 0) {
    console.log('═'.repeat(70));
    console.log('🔷 MATCH PARTIEL PAR NOM DE PRODUIT');
    console.log('   → Le nom du produit apparaît dans un fichier image');
    console.log('═'.repeat(70));
    results.partialMatch.slice(0, 20).forEach((r, i) => {
      console.log(`${i+1}. ${r.product.modelRef} - "${r.product.name}"`);
      r.matches.forEach(m => {
        console.log(`   → ${m.filename} (modelRef: ${m.modelRef})`);
      });
      console.log('');
    });
    if (results.partialMatch.length > 20) {
      console.log(`   ... et ${results.partialMatch.length - 20} autres\n`);
    }
  }

  // Detail: No match at all
  if (results.noMatch.length > 0) {
    console.log('═'.repeat(70));
    console.log('❌ AUCUNE CORRESPONDANCE - IMAGES VRAIMENT MANQUANTES');
    console.log('   → Ces images doivent être uploadées manuellement');
    console.log('═'.repeat(70));
    
    // Group by brand prefix
    const byPrefix = {};
    results.noMatch.forEach(p => {
      const prefix = p.modelRef.substring(0, 2);
      if (!byPrefix[prefix]) byPrefix[prefix] = [];
      byPrefix[prefix].push(p);
    });
    
    for (const [prefix, prods] of Object.entries(byPrefix)) {
      console.log(`\n--- Préfixe "${prefix}" (${prods.length} produits) ---`);
      prods.slice(0, 10).forEach((p, i) => {
        console.log(`${i+1}. ${p.modelRef} | ${p.color} | ${p.name}`);
      });
      if (prods.length > 10) {
        console.log(`   ... et ${prods.length - 10} autres avec ce préfixe`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('   FIN DE L\'ANALYSE');
  console.log('═'.repeat(70));
}

main().catch(console.error);

