/**
 * =============================================================
 * FIX PZ IMAGE PRIORITY AND ADD ALL MISSING IMAGES
 * =============================================================
 * 
 * This script:
 * 1. Scans all images in IMAGES_ROOT folder
 * 2. Re-matches with products in Supabase by modelRef and color
 * 3. For each product, prioritizes image ending with "PZ" in imageUrl
 * 4. Adds ALL matching images to gallery
 * 5. Ensures no images are missed
 * 
 * Run with: npm run fix-pz
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================
// CONFIGURATION
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// =============================================================
// LOGGING
// =============================================================

const log = {
  info: (msg) => console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
  step: (msg) => console.log(`\n\x1b[35m▶ ${msg}\x1b[0m`),
};

let supabase;

// =============================================================
// INIT
// =============================================================

async function init() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMAGES_ROOT) {
    log.error("Missing environment variables. Check .env.upload");
    process.exit(1);
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  log.success("Supabase client initialized");
}

// =============================================================
// FILENAME PARSING
// =============================================================

function parseFilename(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const parts = baseName.split(/[-_]/);
  
  if (parts.length < 2) return null;
  
  return {
    modelRef: parts[0].toUpperCase(),
    color: parts[1].toUpperCase(),
  };
}

// =============================================================
// SCAN IMAGES
// =============================================================

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

// =============================================================
// CHECK IF IMAGE EXISTS IN STORAGE
// =============================================================

async function imageExistsInStorage(fileName) {
  const filePath = `products/${fileName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list("products", {
      search: fileName,
    });
  
  return data && data.length > 0;
}

// =============================================================
// UPLOAD IMAGE
// =============================================================

async function uploadImage(imageInfo) {
  try {
    const fileName = imageInfo.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `products/${fileName}`;
    
    // Check if already uploaded
    const exists = await imageExistsInStorage(fileName);
    if (exists) {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      return { success: true, url: data.publicUrl, fileName };
    }
    
    const fileBuffer = fs.readFileSync(imageInfo.fullPath);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return { success: true, url: data.publicUrl, fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =============================================================
// CHECK IF URL HAS PZ
// =============================================================

function hasPZ(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return /[_-]pz([._-]|$)/.test(urlLower) || urlLower.includes('-pz.') || urlLower.includes('_pz.');
}

// =============================================================
// SORT IMAGES: PZ FIRST
// =============================================================

function sortImagesWithPZFirst(urls) {
  return urls.sort((a, b) => {
    const aIsPZ = hasPZ(a);
    const bIsPZ = hasPZ(b);
    if (aIsPZ && !bIsPZ) return -1;
    if (!aIsPZ && bIsPZ) return 1;
    return 0;
  });
}

// =============================================================
// FIND MATCHING PRODUCTS
// =============================================================

async function findMatchingProducts(modelRef, color) {
  // Try exact match first
  let { data, error } = await supabase
    .from("products")
    .select("id, modelRef, color, imageUrl, gallery")
    .ilike("modelRef", modelRef)
    .ilike("color", color);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Try partial color match (e.g., "BLA" matches "BLACK")
  if (!data || data.length === 0) {
    const { data: partialData, error: partialError } = await supabase
      .from("products")
      .select("id, modelRef, color, imageUrl, gallery")
      .ilike("modelRef", modelRef)
      .ilike("color", `${color}%`);
    
    if (partialError) {
      return { success: false, error: partialError.message };
    }
    
    data = partialData;
  }
  
  // Try modelRef only (for shoes/clothes with color issues)
  if (!data || data.length === 0) {
    const { data: modelOnlyData, error: modelError } = await supabase
      .from("products")
      .select("id, modelRef, color, imageUrl, gallery")
      .ilike("modelRef", modelRef);
    
    if (modelError) {
      return { success: false, error: modelError.message };
    }
    
    data = modelOnlyData;
  }
  
  if (!data || data.length === 0) {
    return { success: false, error: "No matching product found" };
  }
  
  return { success: true, products: data };
}

// =============================================================
// UPDATE PRODUCT
// =============================================================

async function updateProduct(productId, imageUrl, gallery) {
  const { error } = await supabase
    .from("products")
    .update({
      imageUrl: imageUrl,
      gallery: gallery,
    })
    .eq("id", productId);
  
  return { success: !error, error: error?.message };
}

// =============================================================
// MAIN
// =============================================================

async function main() {
  await init();
  
  log.step("Loading all products from Supabase...");
  const { data: allProducts, error: productsError } = await supabase
    .from("products")
    .select("id, modelRef, color, imageUrl, gallery");
  
  if (productsError) {
    log.error(`Failed to load products: ${productsError.message}`);
    process.exit(1);
  }
  
  log.success(`Loaded ${allProducts.length} products`);
  
  log.step("Scanning local images...");
  const allImages = scanImages(IMAGES_ROOT);
  log.success(`Found ${allImages.length} images`);
  
  // Group images by modelRef + color
  const imageGroups = new Map();
  
  for (const img of allImages) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) continue;
    
    const key = `${parsed.modelRef}|${parsed.color}`;
    if (!imageGroups.has(key)) {
      imageGroups.set(key, {
        modelRef: parsed.modelRef,
        color: parsed.color,
        images: [],
      });
    }
    imageGroups.get(key).images.push(img);
  }
  
  log.success(`Grouped into ${imageGroups.size} product groups`);
  
  log.step("Processing and updating products...");
  
  let stats = {
    productsProcessed: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    imagesUploaded: 0,
    imagesSkipped: 0,
    errors: 0,
  };
  
  for (const [key, group] of imageGroups) {
    const { modelRef, color, images } = group;
    stats.productsProcessed++;
    
    // Find matching products
    const matchResult = await findMatchingProducts(modelRef, color);
    
    if (!matchResult.success || !matchResult.products || matchResult.products.length === 0) {
      stats.productsSkipped++;
      continue;
    }
    
    // Upload all images for this group
    const uploadedUrls = [];
    for (const img of images) {
      const result = await uploadImage(img);
      if (result.success) {
        uploadedUrls.push(result.url);
        stats.imagesUploaded++;
      } else {
        stats.imagesSkipped++;
      }
    }
    
    if (uploadedUrls.length === 0) {
      stats.productsSkipped++;
      continue;
    }
    
    // Sort: PZ images first
    const sortedUrls = sortImagesWithPZFirst([...uploadedUrls]);
    const primaryImage = sortedUrls[0]; // First image (PZ if available)
    
    // Update all matching products
    for (const product of matchResult.products) {
      // Merge with existing gallery (avoid duplicates)
      const existingGallery = Array.isArray(product.gallery) ? product.gallery : [];
      const mergedUrls = [...new Set([...sortedUrls, ...existingGallery])];
      const finalSorted = sortImagesWithPZFirst(mergedUrls);
      
      // Update with PZ-prioritized imageUrl
      const updateResult = await updateProduct(
        product.id,
        finalSorted[0],
        finalSorted
      );
      
      if (updateResult.success) {
        stats.productsUpdated++;
        if (stats.productsUpdated % 10 === 0) {
          log.info(`Updated ${stats.productsUpdated} products...`);
        }
      } else {
        stats.errors++;
        log.warning(`Failed to update ${product.modelRef} ${product.color}: ${updateResult.error}`);
      }
    }
  }
  
  log.step("Final Summary");
  console.log("=".repeat(60));
  console.log(`Products processed:  ${stats.productsProcessed}`);
  console.log(`Products updated:    ${stats.productsUpdated}`);
  console.log(`Products skipped:    ${stats.productsSkipped}`);
  console.log(`Images uploaded:     ${stats.imagesUploaded}`);
  console.log(`Images skipped:      ${stats.imagesSkipped}`);
  console.log(`Errors:              ${stats.errors}`);
  console.log("=".repeat(60));
  
  log.success("Done!");
}

main().catch(console.error);


