#!/usr/bin/env node
/**
 * Compte les produits sans images EN UTILISANT EXACTEMENT la même logique que l'admin panel
 * C'est-à-dire en utilisant fetchProducts() de lib/fetchProducts.ts
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Force auto-discovery of sheets (like Vercel does)
process.env.GOOGLE_SHEET_NAME = "";

async function main() {
  console.log('═'.repeat(70));
  console.log('   COMPTAGE ADMIN PANEL - MÊME LOGIQUE QUE LE SITE');
  console.log('═'.repeat(70));
  console.log('');

  // Importer fetchProducts dynamiquement
  const { fetchProducts } = await import('../lib/fetchProducts.ts');
  
  console.log('Chargement des produits via fetchProducts()...\n');
  
  const products = await fetchProducts();
  
  const withImages = products.filter(p => p.imageUrl && !p.imageUrl.includes('default.png'));
  const withoutImages = products.filter(p => !p.imageUrl || p.imageUrl.includes('default.png'));
  
  console.log('═'.repeat(70));
  console.log('   RÉSULTATS (même données que l\'admin panel)');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`   TOTAL PRODUITS:     ${products.length}`);
  console.log(`   ✅ Avec images:     ${withImages.length}`);
  console.log(`   ❌ SANS images:     ${withoutImages.length}`);
  console.log('');
  
  // Stats par marque
  const byBrand = {};
  for (const p of products) {
    const brand = p.brand || 'UNKNOWN';
    if (!byBrand[brand]) byBrand[brand] = { total: 0, withImg: 0, withoutImg: 0 };
    byBrand[brand].total++;
    if (p.imageUrl && !p.imageUrl.includes('default.png')) {
      byBrand[brand].withImg++;
    } else {
      byBrand[brand].withoutImg++;
    }
  }
  
  console.log('   Par marque:');
  for (const [brand, stats] of Object.entries(byBrand)) {
    console.log(`   • ${brand}: ${stats.withImg}/${stats.total} avec images (${stats.withoutImg} sans)`);
  }
  console.log('');
  
  // Liste des 50 premiers produits sans images
  if (withoutImages.length > 0) {
    console.log('═'.repeat(70));
    console.log(`   LISTE DES PRODUITS SANS IMAGES (premiers 50 sur ${withoutImages.length})`);
    console.log('═'.repeat(70));
    withoutImages.slice(0, 50).forEach((p, i) => {
      console.log(`${i + 1}. ${p.modelRef} | ${p.color} | ${p.productName || p.bagName || '-'}`);
    });
    if (withoutImages.length > 50) {
      console.log(`\n   ... et ${withoutImages.length - 50} autres`);
    }
  }
  
  console.log('');
}

main().catch(console.error);

