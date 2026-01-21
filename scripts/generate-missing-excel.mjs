#!/usr/bin/env node
/**
 * Génère un fichier Excel avec les produits vraiment manquants (sans aucune image)
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Force auto-discovery
process.env.GOOGLE_SHEET_NAME = "";

async function main() {
  console.log('═'.repeat(70));
  console.log('   GÉNÉRATION EXCEL DES PRODUITS SANS IMAGES');
  console.log('═'.repeat(70));
  console.log('');

  const { fetchProducts } = await import('../lib/fetchProducts.ts');
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Get all products with improved matching
  console.log('1. Chargement des produits (avec matching amélioré)...');
  const products = await fetchProducts();
  const withoutImages = products.filter(p => !p.imageUrl || p.imageUrl.includes('default.png'));
  console.log(`   ${withoutImages.length} produits sans images après amélioration du matching\n`);

  // 2. Get all images to check for potential matches
  console.log('2. Chargement des images pour analyse...');
  let allImages = [];
  let off = 0;
  while (true) {
    const { data } = await supabase.from('image_index').select('model_ref, color, filename').range(off, off + 999);
    if (!data || !data.length) break;
    allImages.push(...data);
    off += 1000;
  }

  const imagesByModelRef = new Map();
  for (const img of allImages) {
    const mr = img.model_ref.toUpperCase();
    if (!imagesByModelRef.has(mr)) imagesByModelRef.set(mr, []);
    imagesByModelRef.get(mr).push(img);
  }
  console.log(`   ${allImages.length} images dans Supabase\n`);

  // 3. Analyze each missing product
  console.log('3. Analyse des produits manquants...');
  
  const excelData = [];
  
  for (const product of withoutImages) {
    const modelRef = product.modelRef.toUpperCase();
    const color = product.color.toUpperCase();
    const productName = product.productName || product.bagName || '';
    
    // Check for similar modelRefs
    const prefix = modelRef.substring(0, Math.min(6, modelRef.length));
    const similarModels = [];
    for (const [mr, imgs] of imagesByModelRef.entries()) {
      if (mr !== modelRef && mr.startsWith(prefix)) {
        similarModels.push(mr);
      }
    }
    
    excelData.push({
      'ModelRef': modelRef,
      'Couleur': color,
      'Nom Produit': productName,
      'Marque': product.brand || '',
      'Catégorie': product.subcategory || product.category || '',
      'ModelRefs Similaires': similarModels.slice(0, 5).join(', '),
      'ItemCode': product.itemCode || '',
      'Prix Retail': product.priceRetail || 0,
      'Prix Wholesale': product.priceWholesale || 0,
      'Stock': product.stockQuantity || 0,
    });
  }

  // 4. Group by brand for summary
  const byBrand = {};
  for (const row of excelData) {
    const brand = row['Marque'] || 'UNKNOWN';
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(row);
  }

  console.log(`\n4. Résumé par marque:`);
  for (const [brand, items] of Object.entries(byBrand)) {
    console.log(`   • ${brand}: ${items.length} produits manquants`);
  }

  // 5. Create Excel file
  console.log('\n5. Création du fichier Excel...');
  
  const workbook = XLSX.utils.book_new();
  
  // Main sheet with all missing products
  const mainSheet = XLSX.utils.json_to_sheet(excelData);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Produits Sans Images');
  
  // Sheet per brand
  for (const [brand, items] of Object.entries(byBrand)) {
    if (items.length > 0) {
      const brandSheet = XLSX.utils.json_to_sheet(items);
      const sheetName = brand.substring(0, 31); // Excel limit
      XLSX.utils.book_append_sheet(workbook, brandSheet, sheetName);
    }
  }
  
  // Summary sheet
  const summaryData = Object.entries(byBrand).map(([brand, items]) => ({
    'Marque': brand,
    'Nombre de Produits Manquants': items.length,
  }));
  summaryData.push({
    'Marque': 'TOTAL',
    'Nombre de Produits Manquants': excelData.length,
  });
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');
  
  // Write file
  const filename = `produits_sans_images_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filepath = join(__dirname, '..', filename);
  XLSX.writeFile(workbook, filepath);
  
  console.log(`\n✅ Fichier Excel créé: ${filename}`);
  console.log(`   Chemin: ${filepath}`);
  console.log(`   Total: ${excelData.length} produits sans images`);
  
  console.log('\n' + '═'.repeat(70));
  console.log('   TERMINÉ');
  console.log('═'.repeat(70));
}

main().catch(console.error);

