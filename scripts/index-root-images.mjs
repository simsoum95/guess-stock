#!/usr/bin/env node
/**
 * Script pour indexer les images à la racine du bucket guess-images
 * Ces images n'étaient pas indexées car le code ne regardait que le dossier "products"
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

/**
 * Parse filename to extract modelRef and color
 */
function parseFilename(fileName) {
  const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
  
  // Try dash format: MODELREF-COLOR-...
  if (baseName.includes("-")) {
    const parts = baseName.split("-");
    if (parts.length >= 2) {
      return {
        modelRef: parts[0].trim().toUpperCase(),
        color: parts[1].trim().toUpperCase(),
      };
    }
  }
  
  // Try underscore format: MODELREF_COLOR_...
  if (baseName.includes("_")) {
    const parts = baseName.split("_");
    if (parts.length >= 2) {
      return {
        modelRef: parts[0].trim().toUpperCase(),
        color: parts[1].trim().toUpperCase(),
      };
    }
  }

  return null;
}

async function indexRootImages() {
  console.log('🔍 Indexation des images à la racine du bucket guess-images...');
  console.log('=' .repeat(60));
  
  // List ALL files at root (not in any folder)
  let allFiles = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase.storage
      .from('guess-images')
      .list('', { 
        limit: pageSize, 
        offset,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('Erreur listing:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    // Filter out folders (items without extension)
    const files = data.filter(f => f.name.includes('.'));
    allFiles.push(...files);
    
    offset += pageSize;
    console.log(`   Chargé ${allFiles.length} fichiers...`);
    
    if (data.length < pageSize) break;
  }
  
  console.log(`\n📁 Total fichiers à la racine: ${allFiles.length}`);
  
  // Parse and prepare for indexing
  const toIndex = [];
  let skipped = 0;
  
  for (const file of allFiles) {
    const parsed = parseFilename(file.name);
    if (!parsed) {
      skipped++;
      continue;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('guess-images')
      .getPublicUrl(file.name); // Root level, no folder prefix
    
    toIndex.push({
      model_ref: parsed.modelRef,
      color: parsed.color,
      filename: file.name,
      url: urlData?.publicUrl || null,
    });
  }
  
  console.log(`✅ Images parsées: ${toIndex.length}`);
  console.log(`⏭️ Ignorées (format non reconnu): ${skipped}`);
  
  // Check existing indexed images
  const { data: existing } = await supabase
    .from('image_index')
    .select('filename');
  
  const existingFilenames = new Set(existing?.map(e => e.filename) || []);
  
  const newImages = toIndex.filter(img => !existingFilenames.has(img.filename));
  console.log(`\n🆕 Nouvelles images à indexer: ${newImages.length}`);
  console.log(`📝 Déjà indexées: ${toIndex.length - newImages.length}`);
  
  if (newImages.length === 0) {
    console.log('\n✅ Toutes les images sont déjà indexées!');
    return;
  }
  
  // Insert new images in batches
  console.log('\n📤 Insertion dans image_index...');
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < newImages.length; i += 100) {
    const batch = newImages.slice(i, i + 100);
    
    const { error } = await supabase
      .from('image_index')
      .upsert(batch, { onConflict: 'filename' });
    
    if (error) {
      console.error(`   Erreur batch ${i}: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
    }
    
    if ((i + 100) % 500 === 0 || i + 100 >= newImages.length) {
      console.log(`   Progression: ${Math.min(i + 100, newImages.length)}/${newImages.length}`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('=' .repeat(60));
  console.log(`Total fichiers à la racine: ${allFiles.length}`);
  console.log(`Images parsées:             ${toIndex.length}`);
  console.log(`Nouvelles indexées:         ${inserted}`);
  console.log(`Erreurs:                    ${errors}`);
  console.log('=' .repeat(60));
  
  // Verify
  const { count } = await supabase
    .from('image_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total images dans l'index: ${count}`);
  console.log('\n✅ Indexation terminée!');
}

indexRootImages().catch(console.error);

