#!/usr/bin/env node
/**
 * Script pour supprimer TOUTES les images scrapées
 * et garder uniquement les images uploadées manuellement
 * 
 * Images scrapées identifiées par:
 * - VILEBREQUIN: codes commençant par PYRE, BMBAF, CRSH, JIMC, JIMA, JIHI, JIIA, JOIU, BMBA, CPPA, PLTH, etc.
 * - SAM EDELMAN: codes commençant par HBSE, FESE, SBSE, ou noms avec "ALIE", "ARYA", "ASHTYN", "ASTRID", "BARDEN", etc.
 * - Autres patterns de scraping
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

// Patterns des images SCRAPÉES à supprimer
const SCRAPED_PATTERNS = {
  // VILEBREQUIN - codes 8 caractères commençant par ces préfixes
  vilebrequin: [
    'PYRE', 'BMBAF', 'CRSH', 'JIMC', 'JIMA', 'JIHI', 'JIIA', 'JOIU', 
    'BMBA', 'CPPA', 'PLTH', 'JIII', 'CRSA', 'BMSA', 'BMHX'
  ],
  // SAM EDELMAN - codes commençant par ces préfixes
  samEdelman: [
    'HBSE', 'FESE', 'SBSE'
  ],
  // SAM EDELMAN - noms de produits scrapés (avec espaces)
  samEdelmanProducts: [
    'ALIE STUD', 'ARYA COZY', 'ASHTYN', 'ASTRID COZY', 'BARDEN',
    'BAY', 'BIANKA', 'BRANDIE', 'CIRCUS', 'DEANA', 'DORI', 
    'ELISE', 'ETHYL', 'FELICIA', 'HAZEL', 'HILARY', 'JATINE',
    'LAGUNA', 'LINNIE', 'LORAINE', 'LUANA', 'MEENA', 'MIA',
    'MICHAELA', 'PENNY', 'PIPPA', 'PIPPI', 'RAQUEL', 'REMI',
    'SAKURA', 'SHAY', 'TAYE', 'THEA', 'TORI', 'WAYLON', 'YARO'
  ]
};

const stats = {
  totalInIndex: 0,
  totalInStorage: 0,
  scrapedInIndex: 0,
  scrapedInStorage: 0,
  deletedFromIndex: 0,
  deletedFromStorage: 0,
  kept: 0,
  errors: 0,
};

/**
 * Vérifie si un nom de fichier correspond à une image scrapée
 */
function isScrapedImage(filename) {
  const upper = filename.toUpperCase();
  
  // Check VILEBREQUIN patterns
  for (const prefix of SCRAPED_PATTERNS.vilebrequin) {
    if (upper.startsWith(prefix)) return true;
  }
  
  // Check SAM EDELMAN code patterns
  for (const prefix of SCRAPED_PATTERNS.samEdelman) {
    if (upper.startsWith(prefix)) return true;
  }
  
  // Check SAM EDELMAN product name patterns (with spaces or underscores)
  for (const product of SCRAPED_PATTERNS.samEdelmanProducts) {
    const normalized = product.replace(/ /g, '_').toUpperCase();
    const normalizedSpace = product.toUpperCase();
    if (upper.startsWith(normalized) || upper.startsWith(normalizedSpace)) return true;
  }
  
  return false;
}

/**
 * Supprime les images scrapées de l'index
 */
async function deleteFromIndex() {
  console.log('\n📋 Analyse de la table image_index...');
  
  // Récupérer toutes les images de l'index
  let allImages = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('image_index')
      .select('id, filename, model_ref')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Erreur:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allImages.push(...data);
    offset += pageSize;
    
    if (data.length < pageSize) break;
  }
  
  stats.totalInIndex = allImages.length;
  console.log(`   Total dans index: ${stats.totalInIndex}`);
  
  // Identifier les images scrapées
  const scrapedImages = allImages.filter(img => isScrapedImage(img.filename));
  const keptImages = allImages.filter(img => !isScrapedImage(img.filename));
  
  stats.scrapedInIndex = scrapedImages.length;
  stats.kept = keptImages.length;
  
  console.log(`   🗑️ Images scrapées à supprimer: ${stats.scrapedInIndex}`);
  console.log(`   ✅ Images à garder: ${stats.kept}`);
  
  // Exemples d'images scrapées
  console.log('\n   Exemples d\'images scrapées:');
  scrapedImages.slice(0, 10).forEach(img => {
    console.log(`      - ${img.filename}`);
  });
  
  // Exemples d'images gardées
  console.log('\n   Exemples d\'images gardées:');
  keptImages.slice(0, 10).forEach(img => {
    console.log(`      - ${img.filename}`);
  });
  
  // Supprimer les images scrapées de l'index
  if (scrapedImages.length > 0) {
    console.log('\n   Suppression de l\'index en cours...');
    
    // Supprimer par batches de 100
    for (let i = 0; i < scrapedImages.length; i += 100) {
      const batch = scrapedImages.slice(i, i + 100);
      const ids = batch.map(img => img.id);
      
      const { error } = await supabase
        .from('image_index')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error(`   Erreur suppression batch: ${error.message}`);
        stats.errors++;
      } else {
        stats.deletedFromIndex += batch.length;
      }
      
      // Progress
      if ((i + 100) % 500 === 0 || i + 100 >= scrapedImages.length) {
        console.log(`   Progression: ${Math.min(i + 100, scrapedImages.length)}/${scrapedImages.length}`);
      }
    }
  }
  
  return scrapedImages.map(img => img.filename);
}

/**
 * Supprime les fichiers scrapés du Storage
 */
async function deleteFromStorage(scrapedFilenames) {
  console.log('\n📁 Analyse du Storage...');
  
  // Lister tous les fichiers dans products/
  let allFiles = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase.storage
      .from('guess-images')
      .list('products', {
        limit: pageSize,
        offset: offset,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('Erreur Storage:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    // Filtrer les fichiers (pas les dossiers)
    const files = data.filter(f => f.name.includes('.'));
    allFiles.push(...files);
    offset += pageSize;
    
    if (data.length < pageSize) break;
  }
  
  stats.totalInStorage = allFiles.length;
  console.log(`   Total dans Storage: ${stats.totalInStorage}`);
  
  // Identifier les fichiers scrapés
  const scrapedFiles = allFiles.filter(f => isScrapedImage(f.name));
  stats.scrapedInStorage = scrapedFiles.length;
  
  console.log(`   🗑️ Fichiers scrapés à supprimer: ${stats.scrapedInStorage}`);
  
  // Supprimer les fichiers scrapés
  if (scrapedFiles.length > 0) {
    console.log('\n   Suppression du Storage en cours...');
    
    // Supprimer par batches de 50
    for (let i = 0; i < scrapedFiles.length; i += 50) {
      const batch = scrapedFiles.slice(i, i + 50);
      const paths = batch.map(f => `products/${f.name}`);
      
      const { error } = await supabase.storage
        .from('guess-images')
        .remove(paths);
      
      if (error) {
        console.error(`   Erreur suppression Storage: ${error.message}`);
        stats.errors++;
      } else {
        stats.deletedFromStorage += batch.length;
      }
      
      // Progress
      if ((i + 50) % 200 === 0 || i + 50 >= scrapedFiles.length) {
        console.log(`   Progression: ${Math.min(i + 50, scrapedFiles.length)}/${scrapedFiles.length}`);
      }
      
      // Petite pause pour ne pas surcharger
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

/**
 * Main
 */
async function main() {
  console.log('🗑️ SUPPRESSION DES IMAGES SCRAPÉES');
  console.log('='.repeat(60));
  console.log('Patterns identifiés comme scrapés:');
  console.log('  - VILEBREQUIN:', SCRAPED_PATTERNS.vilebrequin.join(', '));
  console.log('  - SAM EDELMAN codes:', SCRAPED_PATTERNS.samEdelman.join(', '));
  console.log('  - SAM EDELMAN products:', SCRAPED_PATTERNS.samEdelmanProducts.slice(0, 5).join(', '), '...');
  console.log('='.repeat(60));
  
  // 1. Supprimer de l'index
  const scrapedFilenames = await deleteFromIndex();
  
  // 2. Supprimer du Storage
  await deleteFromStorage(scrapedFilenames);
  
  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Total dans index:           ${stats.totalInIndex}`);
  console.log(`Total dans Storage:         ${stats.totalInStorage}`);
  console.log(`Images scrapées (index):    ${stats.scrapedInIndex}`);
  console.log(`Fichiers scrapés (Storage): ${stats.scrapedInStorage}`);
  console.log(`Supprimées de l'index:      ${stats.deletedFromIndex}`);
  console.log(`Supprimées du Storage:      ${stats.deletedFromStorage}`);
  console.log(`Images gardées:             ${stats.kept}`);
  console.log(`Erreurs:                    ${stats.errors}`);
  console.log('='.repeat(60));
  console.log('\n✅ Suppression terminée!');
}

main().catch(console.error);

