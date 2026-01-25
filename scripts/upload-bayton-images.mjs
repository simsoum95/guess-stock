#!/usr/bin/env node
/**
 * Upload BAYTON images to Supabase Storage
 * Format: BA-10001_LGR_1.jpg = ItemCode_ColorCode_Number.jpg
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
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_FOLDER = 'C:\\Users\\1\\Desktop\\בייטון מכווץ';
const BUCKET = 'guess-images';
const BATCH_SIZE = 10;

const stats = {
  total: 0,
  uploaded: 0,
  indexed: 0,
  skipped: 0,
  errors: 0
};

/**
 * Parse BAYTON filename to extract itemCode and color
 * Formats:
 * - BA-10001_LGR_1.jpg -> itemCode: BA-10001, color: LGR
 * - BA-10008_GOLD_1.jpg -> itemCode: BA-10008, color: GOLD
 * - BA-10063.jpg -> itemCode: BA-10063, color: DEFAULT
 * - BA_10063_1.jpg -> itemCode: BA-10063, color: DEFAULT
 */
function parseFilename(filename) {
  const baseName = filename.replace(/\.(jpg|jpeg|png)$/i, '');
  
  // Handle BA_10063 format (underscore instead of dash)
  let normalizedName = baseName.replace(/^BA_/, 'BA-');
  
  // Split by underscore
  const parts = normalizedName.split('_');
  
  if (parts.length >= 2) {
    const itemCode = parts[0].toUpperCase();
    let colorCode = parts[1].toUpperCase();
    
    // Skip NULL colors or convert to DEFAULT
    if (colorCode === 'NULL' || !colorCode || /^\d+$/.test(colorCode)) {
      colorCode = 'DEFAULT';
    }
    
    return { itemCode, colorCode };
  } else if (parts.length === 1) {
    // Just itemCode, no color (e.g., BA-10063.jpg)
    return { itemCode: parts[0].toUpperCase(), colorCode: 'DEFAULT' };
  }
  
  return null;
}

/**
 * Upload a single image
 */
async function uploadImage(filePath, filename) {
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.log(`  Skip (invalid format): ${filename}`);
    stats.skipped++;
    return false;
  }

  const { itemCode, colorCode } = parsed;
  
  // Clean filename (remove Hebrew RTL marks)
  const cleanFilename = filename.replace(/[\u200F\u200E]/g, '');
  
  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create storage path: products/ITEMCODE-COLOR-filename.jpg
    const storagePath = `products/${itemCode}-${colorCode}-${cleanFilename}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`  Error ${filename}:`, uploadError.message);
      stats.errors++;
      return false;
    }

    stats.uploaded++;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // Index in database
    const { error: indexError } = await supabase
      .from('image_index')
      .upsert({
        model_ref: itemCode,
        color: colorCode,
        filename: `${itemCode}-${colorCode}-${cleanFilename}`,
        url: urlData.publicUrl
      }, {
        onConflict: 'filename'
      });

    if (indexError) {
      console.warn(`  Index error ${filename}:`, indexError.message);
    } else {
      stats.indexed++;
    }

    return true;
  } catch (err) {
    console.error(`  Exception ${filename}:`, err.message);
    stats.errors++;
    return false;
  }
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
  console.log('='.repeat(60));
  console.log('  UPLOAD BAYTON IMAGES');
  console.log('='.repeat(60));
  console.log('');
  console.log('Source:', SOURCE_FOLDER);
  console.log('Destination: Supabase Storage (' + BUCKET + ')');
  console.log('');

  // List all image files
  const allFiles = fs.readdirSync(SOURCE_FOLDER)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  
  stats.total = allFiles.length;
  console.log(`Files found: ${stats.total}`);
  console.log('');
  console.log('Starting upload...');
  console.log('');

  // Process in batches
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    await uploadBatch(allFiles, i);
    
    // Progress update every 50 files
    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= allFiles.length) {
      const progress = Math.min(i + BATCH_SIZE, allFiles.length);
      const percent = ((progress / allFiles.length) * 100).toFixed(1);
      console.log(`Progress: ${progress}/${allFiles.length} (${percent}%) - Uploaded: ${stats.uploaded}, Indexed: ${stats.indexed}, Errors: ${stats.errors}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files:    ${stats.total}`);
  console.log(`Uploaded:       ${stats.uploaded}`);
  console.log(`Indexed:        ${stats.indexed}`);
  console.log(`Skipped:        ${stats.skipped}`);
  console.log(`Errors:         ${stats.errors}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Upload complete!');
}

main().catch(console.error);

