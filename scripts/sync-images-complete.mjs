/**
 * COMPLETE IMAGE SYNCHRONIZATION SCRIPT
 * 
 * This script:
 * 1. Scans local images folder
 * 2. Uploads new images to Supabase Storage
 * 3. Updates the image_index table with all images
 * 4. Uses smart parsing for different naming patterns
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';

// Configuration
const LOCAL_IMAGES_PATH = "C:\\Users\\1\\Desktop\\new image guess";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "guess-images";
const STORAGE_FOLDER = "products";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Parse image filename to extract modelRef and color
 * Handles both patterns:
 * - Underscore: A7460108_BLA_KEYCHAINS_F.jpg
 * - Dash: AG963306-NATURALBLACK-ANADELA-F-.jpg
 */
function parseImageFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  
  // Try underscore pattern first: MODELREF_COLOR_NAME_SUFFIX
  const underscoreParts = nameWithoutExt.split('_');
  if (underscoreParts.length >= 3) {
    const modelRef = underscoreParts[0].toUpperCase();
    const color = underscoreParts[1].toUpperCase();
    // Validate: modelRef should have letters+numbers, color should be 2+ chars
    if (/^[A-Z0-9]{5,}$/.test(modelRef) && color.length >= 2) {
      return { modelRef, color };
    }
  }
  
  // Try dash pattern: MODELREF-COLOR-NAME-SUFFIX
  const dashParts = nameWithoutExt.split('-');
  if (dashParts.length >= 3) {
    const modelRef = dashParts[0].toUpperCase();
    const color = dashParts[1].toUpperCase();
    // Validate
    if (/^[A-Z0-9]{5,}$/.test(modelRef) && color.length >= 2) {
      return { modelRef, color };
    }
  }
  
  // Fallback: try to find modelRef pattern anywhere
  const modelRefMatch = nameWithoutExt.match(/^([A-Z]{2}[0-9]{5,}|[A-Z][A-Z0-9]{6,})/i);
  if (modelRefMatch) {
    const modelRef = modelRefMatch[1].toUpperCase();
    // Try to extract color after modelRef
    const remaining = nameWithoutExt.substring(modelRef.length).replace(/^[-_]/, '');
    const colorMatch = remaining.match(/^([A-Z]+)/i);
    if (colorMatch) {
      return { modelRef, color: colorMatch[1].toUpperCase() };
    }
  }
  
  return null;
}

/**
 * Get all existing images from Supabase Storage
 */
async function getExistingImages() {
  console.log("📦 Fetching existing images from Supabase Storage...");
  const existingImages = new Set();
  
  let offset = 0;
  const limit = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(STORAGE_FOLDER, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    
    if (error || !data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of data) {
      if (item.name.includes('.')) {
        existingImages.add(item.name.toUpperCase());
      }
    }
    
    if (data.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
    
    process.stdout.write(`\r   ${existingImages.size} images found...`);
  }
  
  console.log(`\n   ✅ ${existingImages.size} existing images in Storage`);
  return existingImages;
}

/**
 * Upload new images to Supabase Storage
 */
async function uploadNewImages(localFiles, existingImages) {
  console.log("\n📤 Uploading new images...");
  
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < localFiles.length; i++) {
    const file = localFiles[i];
    const upperName = file.toUpperCase();
    
    // Skip if already exists
    if (existingImages.has(upperName)) {
      skipped++;
      continue;
    }
    
    try {
      const filePath = path.join(LOCAL_IMAGES_PATH, file);
      const fileContent = await fs.readFile(filePath);
      const storagePath = `${STORAGE_FOLDER}/${file}`;
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileContent, {
          contentType: 'image/jpeg',
          upsert: false
        });
      
      if (error) {
        if (error.message?.includes('already exists')) {
          skipped++;
        } else {
          errors++;
          if (errors <= 5) console.error(`\n   ❌ ${file}: ${error.message}`);
        }
      } else {
        uploaded++;
      }
    } catch (err) {
      errors++;
    }
    
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r   Progress: ${i + 1}/${localFiles.length} | Uploaded: ${uploaded} | Skipped: ${skipped} | Errors: ${errors}`);
    }
  }
  
  console.log(`\n   ✅ Upload complete: ${uploaded} new, ${skipped} skipped, ${errors} errors`);
  return uploaded;
}

/**
 * Re-index all images in the image_index table
 */
async function reindexAllImages() {
  console.log("\n🗂️  Re-indexing all images...");
  
  // Clear existing index
  console.log("   Clearing existing index...");
  const { error: deleteError } = await supabase.from('image_index').delete().neq('id', 0);
  if (deleteError) {
    console.warn("   Warning: Could not clear index:", deleteError.message);
  }
  
  // Get all images from storage with pagination
  console.log("   Fetching all images from Storage...");
  const allImages = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(STORAGE_FOLDER, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    
    if (error || !data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of data) {
      if (item.name.includes('.')) {
        allImages.push(item.name);
      }
    }
    
    if (data.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
    
    process.stdout.write(`\r   ${allImages.length} images loaded...`);
  }
  
  console.log(`\n   ✅ ${allImages.length} total images to index`);
  
  // Parse and prepare records
  console.log("   Parsing image filenames...");
  const records = [];
  let parseErrors = 0;
  
  for (const filename of allImages) {
    const parsed = parseImageFilename(filename);
    if (parsed) {
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`${STORAGE_FOLDER}/${filename}`);
      
      records.push({
        model_ref: parsed.modelRef,
        color: parsed.color,
        filename: filename,
        url: urlData.publicUrl
      });
    } else {
      parseErrors++;
    }
  }
  
  console.log(`   ✅ ${records.length} images parsed (${parseErrors} parse errors)`);
  
  // Insert in batches
  console.log("   Inserting into index...");
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabase.from('image_index').upsert(batch, {
      onConflict: 'filename',
      ignoreDuplicates: true
    });
    
    if (error) {
      console.error(`   Batch error at ${i}:`, error.message);
    } else {
      inserted += batch.length;
    }
    
    process.stdout.write(`\r   ${inserted}/${records.length} indexed...`);
  }
  
  console.log(`\n   ✅ Index complete: ${inserted} images`);
  return inserted;
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 COMPLETE IMAGE SYNCHRONIZATION");
  console.log("==================================\n");
  
  // Step 1: Get local files
  console.log("📁 Scanning local images folder...");
  let localFiles;
  try {
    const files = await fs.readdir(LOCAL_IMAGES_PATH);
    localFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    console.log(`   ✅ ${localFiles.length} local images found\n`);
  } catch (err) {
    console.error(`   ❌ Error reading local folder: ${err.message}`);
    process.exit(1);
  }
  
  // Step 2: Get existing images
  const existingImages = await getExistingImages();
  
  // Step 3: Upload new images
  const newCount = localFiles.filter(f => !existingImages.has(f.toUpperCase())).length;
  console.log(`\n   📊 ${newCount} new images to upload`);
  
  if (newCount > 0) {
    await uploadNewImages(localFiles, existingImages);
  } else {
    console.log("   ⏭️  No new images to upload");
  }
  
  // Step 4: Re-index all images
  await reindexAllImages();
  
  console.log("\n✅ SYNCHRONIZATION COMPLETE!");
  console.log("   - All images are in Supabase Storage");
  console.log("   - image_index table is updated");
  console.log("   - Refresh your catalog to see the changes");
}

main().catch(console.error);

