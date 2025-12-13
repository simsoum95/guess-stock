/**
 * =============================================================
 * SUPABASE IMAGE UPLOAD SCRIPT
 * =============================================================
 * 
 * This script:
 * 1. Recursively scans all images in IMAGES_ROOT folder
 * 2. Extracts modelRef and color from filename (format: MODELREF-COLOR-ANYTHING.jpg)
 * 3. Matches products in Supabase by modelRef and color
 * 4. Uploads images to Supabase Storage (bucket: guess-images)
 * 5. Updates imageUrl (first image) and gallery (all images) in products table
 * 
 * Run with: npm run upload-images
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================
// CONFIGURATION
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";

// Supported image extensions
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// =============================================================
// LOGGING UTILITIES
// =============================================================

const log = {
  info: (msg) => console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
  step: (msg) => console.log(`\n\x1b[35m▶ ${msg}\x1b[0m`),
  separator: () => console.log("\n" + "=".repeat(60) + "\n"),
};

// =============================================================
// VALIDATION
// =============================================================

function validateEnvironment() {
  log.step("Validating environment variables...");

  const errors = [];

  if (!SUPABASE_URL) {
    errors.push("SUPABASE_URL is not set");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  if (SUPABASE_SERVICE_ROLE_KEY === "PASTE_SERVICE_ROLE_HERE") {
    errors.push("SUPABASE_SERVICE_ROLE_KEY has not been configured - please paste your service_role key in .env.upload");
  }

  if (!IMAGES_ROOT) {
    errors.push("IMAGES_ROOT is not set");
  }

  if (IMAGES_ROOT && !fs.existsSync(IMAGES_ROOT)) {
    errors.push(`IMAGES_ROOT folder does not exist: ${IMAGES_ROOT}`);
  }

  if (errors.length > 0) {
    log.error("Environment validation failed:");
    errors.forEach((e) => log.error(`  - ${e}`));
    process.exit(1);
  }

  log.success("Environment variables validated");
  log.info(`SUPABASE_URL: ${SUPABASE_URL}`);
  log.info(`IMAGES_ROOT: ${IMAGES_ROOT}`);
}

// =============================================================
// SUPABASE CLIENT
// =============================================================

let supabase;

function initSupabaseClient() {
  log.step("Initializing Supabase client with service_role key...");
  
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  log.success("Supabase client initialized");
}

// =============================================================
// BUCKET MANAGEMENT
// =============================================================

async function ensureBucketExists() {
  log.step(`Checking if bucket '${BUCKET_NAME}' exists...`);

  try {
    // List all buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);

    if (bucketExists) {
      log.success(`Bucket '${BUCKET_NAME}' already exists`);
    } else {
      log.info(`Creating bucket '${BUCKET_NAME}'...`);
      
      const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      log.success(`Bucket '${BUCKET_NAME}' created and set to public`);
    }

    // Verify bucket is public
    const { data: bucket, error: getError } = await supabase.storage.getBucket(BUCKET_NAME);
    
    if (getError) {
      log.warning(`Could not verify bucket settings: ${getError.message}`);
    } else {
      log.info(`Bucket public: ${bucket.public}`);
    }

  } catch (err) {
    log.error(`Bucket setup failed: ${err.message}`);
    process.exit(1);
  }
}

// =============================================================
// TEST SUPABASE CONNECTIVITY
// =============================================================

async function testSupabaseConnection() {
  log.step("Testing Supabase connectivity...");

  try {
    const { count, error } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    log.success(`Connected to Supabase - Found ${count} products in database`);
    return count;

  } catch (err) {
    log.error(`Supabase connection failed: ${err.message}`);
    process.exit(1);
  }
}

// =============================================================
// RECURSIVE FILE SCANNER
// =============================================================

function scanImagesRecursively(dir, images = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanImagesRecursively(fullPath, images);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        images.push({
          fullPath,
          fileName: entry.name,
          relativePath: path.relative(IMAGES_ROOT, fullPath),
        });
      }
    }
  }

  return images;
}

// =============================================================
// FILENAME PARSER
// =============================================================

function parseFilename(fileName) {
  // Supports two formats:
  // 1. Dashes: MODELREF-COLOR-ANYTHING.jpg (e.g., BB985220-BLACK CHERRY-JARSON-BZ.jpg)
  // 2. Underscores: MODELREF_COLOR_ANYTHING.jpg (e.g., A7460108_BLA_KEYCHAINS_B.jpg)
  
  const baseName = path.basename(fileName, path.extname(fileName));
  
  // Try dash format first (more specific with potential spaces in color)
  if (baseName.includes("-")) {
    const parts = baseName.split("-");
    if (parts.length >= 2) {
      const modelRef = parts[0].trim().toUpperCase();
      const color = parts[1].trim().toUpperCase();
      return { modelRef, color };
    }
  }
  
  // Try underscore format
  if (baseName.includes("_")) {
    const parts = baseName.split("_");
    if (parts.length >= 2) {
      const modelRef = parts[0].trim().toUpperCase();
      const color = parts[1].trim().toUpperCase();
      return { modelRef, color };
    }
  }

  return null;
}

// =============================================================
// UPLOAD IMAGE TO STORAGE
// =============================================================

async function uploadImage(imageInfo) {
  const { fullPath, fileName, relativePath } = imageInfo;

  try {
    // Read file
    const fileBuffer = fs.readFileSync(fullPath);
    
    // Create storage path (flatten relative path for storage)
    const storagePath = relativePath.replace(/\\/g, "/");
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: getContentType(fileName),
        upsert: true, // Overwrite if exists
      });

    if (error) {
      throw new Error(error.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return {
      success: true,
      url: urlData.publicUrl,
      storagePath,
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/jpeg";
}

// =============================================================
// MATCH AND UPDATE PRODUCTS
// =============================================================

async function findMatchingProduct(modelRef, color) {
  // First try exact match (case-insensitive)
  let { data, error } = await supabase
    .from("products")
    .select("id, modelRef, color, imageUrl, gallery")
    .ilike("modelRef", modelRef)
    .ilike("color", color);

  if (error) {
    return { success: false, error: error.message };
  }

  // If no exact match, try partial color match (color starts with extracted value)
  // This handles abbreviated colors like "BLA" matching "BLACK" or "BLACK CHERRY"
  if (!data || data.length === 0) {
    const partialResult = await supabase
      .from("products")
      .select("id, modelRef, color, imageUrl, gallery")
      .ilike("modelRef", modelRef)
      .ilike("color", `${color}%`);

    if (partialResult.error) {
      return { success: false, error: partialResult.error.message };
    }

    data = partialResult.data;
  }

  if (!data || data.length === 0) {
    return { success: false, error: "No matching product found" };
  }

  // If multiple matches, return all of them
  return { success: true, products: data };
}

async function updateProductImages(productId, imageUrl, gallery) {
  const { error } = await supabase
    .from("products")
    .update({
      imageUrl: imageUrl,
      gallery: gallery,
    })
    .eq("id", productId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================
// MAIN PROCESS
// =============================================================

async function main() {
  console.log("\n");
  log.separator();
  console.log("🖼️  SUPABASE IMAGE UPLOAD SCRIPT");
  log.separator();

  // Step 1: Validate environment
  validateEnvironment();

  // Step 2: Initialize Supabase
  initSupabaseClient();

  // Step 3: Test connection
  await testSupabaseConnection();

  // Step 4: Ensure bucket exists
  await ensureBucketExists();

  // Step 5: Scan images
  log.step(`Scanning images in ${IMAGES_ROOT}...`);
  const images = scanImagesRecursively(IMAGES_ROOT);
  log.success(`Found ${images.length} images to process`);

  if (images.length === 0) {
    log.warning("No images found. Exiting.");
    return;
  }

  // Step 6: Group images by product (modelRef + color)
  log.step("Grouping images by product...");
  
  const productImages = new Map(); // Key: "MODELREF|COLOR" -> Array of image info

  for (const img of images) {
    const parsed = parseFilename(img.fileName);
    
    if (!parsed) {
      log.warning(`Could not parse filename: ${img.fileName}`);
      continue;
    }

    const key = `${parsed.modelRef}|${parsed.color}`;
    
    if (!productImages.has(key)) {
      productImages.set(key, {
        modelRef: parsed.modelRef,
        color: parsed.color,
        images: [],
      });
    }
    
    productImages.get(key).images.push(img);
  }

  log.success(`Grouped into ${productImages.size} unique product combinations`);

  // Step 7: Process each product group
  log.step("Processing products and uploading images...");
  log.separator();

  const stats = {
    totalImages: images.length,
    productsProcessed: 0,
    productsMatched: 0,
    productsNotFound: 0,
    imagesUploaded: 0,
    imagesFailed: 0,
    productsUpdated: 0,
    productsUpdateFailed: 0,
  };

  const notFoundProducts = [];

  for (const [key, productData] of productImages) {
    const { modelRef, color, images: productImgs } = productData;
    
    stats.productsProcessed++;
    
    console.log(`\n[${stats.productsProcessed}/${productImages.size}] Processing: ${modelRef} - ${color}`);
    console.log(`   Images: ${productImgs.length}`);

    // Find matching product(s) in Supabase
    const matchResult = await findMatchingProduct(modelRef, color);

    if (!matchResult.success) {
      log.warning(`   No match found in database`);
      stats.productsNotFound++;
      notFoundProducts.push({ modelRef, color, imageCount: productImgs.length });
      continue;
    }

    stats.productsMatched++;
    
    // Handle multiple matches - update all matching products
    const matchedProducts = matchResult.products;
    console.log(`   ✓ Matched ${matchedProducts.length} product(s)`);

    // Upload all images for this product group (upload once, update all matching products)
    const uploadedUrls = [];

    for (const img of productImgs) {
      const uploadResult = await uploadImage(img);
      
      if (uploadResult.success) {
        uploadedUrls.push(uploadResult.url);
        stats.imagesUploaded++;
        console.log(`   ✓ Uploaded: ${img.fileName}`);
      } else {
        stats.imagesFailed++;
        console.log(`   ✗ Failed: ${img.fileName} - ${uploadResult.error}`);
      }
    }

    if (uploadedUrls.length === 0) {
      log.warning(`   No images uploaded for this product`);
      continue;
    }

    // Update all matching products in database
    for (const product of matchedProducts) {
      const existingGallery = product.gallery || [];
      const newGallery = [...new Set([...existingGallery, ...uploadedUrls])]; // Merge and deduplicate
      const newImageUrl = product.imageUrl || uploadedUrls[0]; // Keep existing or use first uploaded

      const updateResult = await updateProductImages(product.id, newImageUrl, newGallery);

      if (updateResult.success) {
        stats.productsUpdated++;
        console.log(`   ✓ Updated product ${product.id} (${product.color}) with ${uploadedUrls.length} image(s)`);
      } else {
        stats.productsUpdateFailed++;
        console.log(`   ✗ Failed to update product ${product.id}: ${updateResult.error}`);
      }
    }
  }

  // Step 8: Print summary
  log.separator();
  console.log("📊 UPLOAD SUMMARY");
  log.separator();

  console.log(`Total images scanned:     ${stats.totalImages}`);
  console.log(`Product groups found:     ${productImages.size}`);
  console.log(`Products matched:         ${stats.productsMatched}`);
  console.log(`Products not found:       ${stats.productsNotFound}`);
  console.log(`Images uploaded:          ${stats.imagesUploaded}`);
  console.log(`Images failed:            ${stats.imagesFailed}`);
  console.log(`Products updated:         ${stats.productsUpdated}`);
  console.log(`Products update failed:   ${stats.productsUpdateFailed}`);

  if (notFoundProducts.length > 0) {
    log.separator();
    log.warning(`Products not found in database (${notFoundProducts.length}):`);
    
    // Show first 20
    const toShow = notFoundProducts.slice(0, 20);
    for (const p of toShow) {
      console.log(`  - ${p.modelRef} | ${p.color} (${p.imageCount} images)`);
    }
    
    if (notFoundProducts.length > 20) {
      console.log(`  ... and ${notFoundProducts.length - 20} more`);
    }
  }

  log.separator();
  log.success("Upload process completed!");
}

// Run
main().catch((err) => {
  log.error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

