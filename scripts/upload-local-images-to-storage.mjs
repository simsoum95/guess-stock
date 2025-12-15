/**
 * =============================================================
 * UPLOAD LOCAL IMAGES TO SUPABASE STORAGE
 * =============================================================
 * 
 * This script:
 * 1. Scans all images in local IMAGES_ROOT folder
 * 2. Extracts modelRef and color from filename
 * 3. Uploads images to Supabase Storage (bucket: guess-images/products/)
 * 4. Names files as: {modelRef}-{color}-{index}.jpg
 * 
 * Run with: npm run upload-local-images
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT || "C:\\Users\\1\\Desktop\\ALL_IMAGES";
const BUCKET_NAME = "guess-images";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const log = {
  info: (msg) => console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
};

let supabase;

function parseFilename(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const parts = baseName.split(/[-_]/);
  
  if (parts.length < 2) return null;
  
  return {
    modelRef: parts[0].toUpperCase(),
    color: parts[1].toUpperCase(),
  };
}

function scanImages(dir, images = []) {
  if (!fs.existsSync(dir)) return images;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanImages(fullPath, images);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        images.push({
          fileName: entry.name,
          fullPath: fullPath,
        });
      }
    }
  }
  
  return images;
}

async function uploadImage(imageInfo, modelRef, color, index) {
  try {
    const ext = path.extname(imageInfo.fileName);
    const newFileName = `${modelRef}-${color}-${index}${ext}`.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `products/${newFileName}`;
    
    const fileBuffer = fs.readFileSync(imageInfo.fullPath);
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: `image/${ext.slice(1)}`,
        upsert: true, // Overwrite if exists
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return { success: true, url: data.publicUrl, fileName: newFileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("📤 UPLOAD LOCAL IMAGES TO SUPABASE STORAGE");
  console.log("=".repeat(60) + "\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log.error("Missing Supabase credentials. Check .env.upload or .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(IMAGES_ROOT)) {
    log.error(`Images folder not found: ${IMAGES_ROOT}`);
    process.exit(1);
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets.some(b => b.name === BUCKET_NAME)) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (createError) {
      log.error(`Failed to create bucket: ${createError.message}`);
      process.exit(1);
    }
    log.success(`Created bucket: ${BUCKET_NAME}`);
  }

  // Scan images
  log.info(`Scanning images in ${IMAGES_ROOT}...`);
  const allImages = scanImages(IMAGES_ROOT);
  log.success(`Found ${allImages.length} images\n`);

  // Group by product
  const productGroups = new Map();
  
  for (const img of allImages) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) continue;
    
    const key = `${parsed.modelRef}|${parsed.color}`;
    if (!productGroups.has(key)) {
      productGroups.set(key, {
        modelRef: parsed.modelRef,
        color: parsed.color,
        images: [],
      });
    }
    productGroups.get(key).images.push(img);
  }

  log.info(`Grouped into ${productGroups.size} products\n`);
  log.info("Uploading images...\n");

  let stats = {
    uploaded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const [key, group] of productGroups) {
    const { modelRef, color, images } = group;
    
    // Sort images: PZ images first
    const sorted = images.sort((a, b) => {
      const aIsPZ = a.fileName.toLowerCase().includes("-pz") || a.fileName.toLowerCase().includes("_pz");
      const bIsPZ = b.fileName.toLowerCase().includes("-pz") || b.fileName.toLowerCase().includes("_pz");
      if (aIsPZ && !bIsPZ) return -1;
      if (!aIsPZ && bIsPZ) return 1;
      return 0;
    });

    for (let i = 0; i < sorted.length; i++) {
      const img = sorted[i];
      const result = await uploadImage(img, modelRef, color, i + 1);
      
      if (result.success) {
        stats.uploaded++;
        if (stats.uploaded % 100 === 0) {
          log.info(`Uploaded ${stats.uploaded} images...`);
        }
      } else {
        stats.failed++;
        log.warning(`Failed to upload ${img.fileName}: ${result.error}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`Images uploadées:     ${stats.uploaded}`);
  console.log(`Échecs:               ${stats.failed}`);
  console.log(`Produits traités:     ${productGroups.size}`);
  console.log("=".repeat(60) + "\n");

  log.success("Upload terminé !");
  log.info(`Les images sont maintenant accessibles dans Supabase Storage (bucket: ${BUCKET_NAME}/products/)`);
  log.info("Les produits du catalogue afficheront automatiquement ces images");
}

main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});


