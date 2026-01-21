#!/usr/bin/env node
/**
 * Upload GUESS BAGS 2026 images to Supabase Storage
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_FOLDER = 'C:\\Users\\1\\Downloads\\guess bag 26';
const BUCKET = 'guess-images';
const BATCH_SIZE = 10; // Upload 10 files at a time

const stats = {
  total: 0,
  uploaded: 0,
  indexed: 0,
  skipped: 0,
  errors: 0
};

/**
 * Parse filename to extract modelRef and color
 * Format: AB930818_CGM_CAMDEN_B.jpg
 */
function parseFilename(filename) {
  const baseName = filename.replace(/\.(jpg|jpeg|png)$/i, '');
  const parts = baseName.split('_');
  
  if (parts.length >= 2) {
    const modelRef = parts[0].toUpperCase();
    const colorCode = parts[1].toUpperCase();
    return { modelRef, colorCode };
  }
  return null;
}

/**
 * Upload a single image
 */
async function uploadImage(filePath, filename) {
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.log(`  ⏭️ Skipped (invalid format): ${filename}`);
    stats.skipped++;
    return false;
  }

  const { modelRef, colorCode } = parsed;
  
  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create storage path: products/MODELREF-COLOR-filename.jpg
  const storagePath = `products/${modelRef}-${colorCode}-${filename}`;
  
  // Check if already exists
  const { data: existingFile } = await supabase.storage
    .from(BUCKET)
    .list('products', { search: `${modelRef}-${colorCode}-${filename}` });
  
  if (existingFile && existingFile.length > 0) {
    stats.skipped++;
    return false;
  }
  
  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error(`  ❌ Upload error for ${filename}:`, uploadError.message);
    stats.errors++;
    return false;
  }

  stats.uploaded++;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // Index in database (without path column which doesn't exist)
  const { error: indexError } = await supabase
    .from('image_index')
    .upsert({
      model_ref: modelRef,
      color: colorCode,
      filename: `${modelRef}-${colorCode}-${filename}`,
      url: urlData.publicUrl
    }, {
      onConflict: 'filename'
    });

  if (indexError) {
    console.error(`  ⚠️ Index error for ${filename}:`, indexError.message);
  } else {
    stats.indexed++;
  }

  return true;
}

/**
 * Process files in batches
 */
async function uploadBatch(files, startIndex) {
  const batch = files.slice(startIndex, startIndex + BATCH_SIZE);
  const promises = batch.map(file => {
    const filePath = path.join(SOURCE_FOLDER, file);
    return uploadImage(filePath, file);
  });
  
  await Promise.all(promises);
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  UPLOAD GUESS BAGS 2026 SPRING-SUMMER');
  console.log('═'.repeat(60));
  console.log('');
  console.log('Source:', SOURCE_FOLDER);
  console.log('Destination: Supabase Storage (' + BUCKET + ')');
  console.log('');

  // List all image files
  const allFiles = fs.readdirSync(SOURCE_FOLDER)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  
  stats.total = allFiles.length;
  console.log(`📁 Fichiers trouvés: ${stats.total}`);
  console.log('');
  console.log('Début de l\'upload...');
  console.log('');

  // Process in batches
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    await uploadBatch(allFiles, i);
    
    // Progress update every 100 files
    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= allFiles.length) {
      const progress = Math.min(i + BATCH_SIZE, allFiles.length);
      const percent = ((progress / allFiles.length) * 100).toFixed(1);
      console.log(`📤 Progression: ${progress}/${allFiles.length} (${percent}%) - Uploaded: ${stats.uploaded}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('  RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`📁 Total fichiers:    ${stats.total}`);
  console.log(`✅ Uploadés:          ${stats.uploaded}`);
  console.log(`📝 Indexés:           ${stats.indexed}`);
  console.log(`⏭️  Ignorés (existants): ${stats.skipped}`);
  console.log(`❌ Erreurs:           ${stats.errors}`);
  console.log('═'.repeat(60));
  console.log('');
  console.log('✅ Upload terminé !');
}

main().catch(console.error);

