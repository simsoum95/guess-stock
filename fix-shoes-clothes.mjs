/**
 * FIX SHOES & CLOTHES IMAGES
 * Smart color code mapping: DGR→DARK, WHI→WHITE, IVO→IVORY, etc.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";

// COLOR CODE MAPPING - Logique!
const COLOR_CODE_MAP = {
  "BLK": "BLACK",
  "BLA": "BLACK",
  "WHI": "WHITE",
  "WHT": "WHITE",
  "IVO": "IVORY",
  "DGR": "DARK GRAY",
  "DGY": "DARK GRAY",
  "LGR": "LIGHT GRAY",
  "LGY": "LIGHT GRAY",
  "DBL": "DARK BLUE",
  "LBL": "LIGHT BLUE",
  "DBR": "DARK BROWN",
  "LBR": "LIGHT BROWN",
  "MBR": "MEDIUM BROWN",
  "DRD": "DARK RED",
  "LRD": "LIGHT RED",
  "MRD": "MEDIUM RED",
  "DNT": "DARK NATURAL",
  "LNT": "LIGHT NATURAL",
  "MNT": "MEDIUM NATURAL",
  "GLD": "GOLD",
  "GOL": "GOLD",
  "SLV": "SILVER",
  "SIL": "SILVER",
  "BGE": "BEIGE",
  "BEI": "BEIGE",
  "CRM": "CREAM",
  "CRE": "CREAM",
  "TAN": "TAN",
  "TAU": "TAUPE",
  "NAV": "NAVY",
  "GRN": "GREEN",
  "GRE": "GREEN",
  "LGN": "LIGHT GREEN",
  "DGN": "DARK GREEN",
  "PNK": "PINK",
  "PIN": "PINK",
  "RED": "RED",
  "BLU": "BLUE",
  "ORG": "ORANGE",
  "ORA": "ORANGE",
  "YEL": "YELLOW",
  "PUR": "PURPLE",
  "COG": "COGNAC",
  "COA": "COAL",
  "CHA": "CHARCOAL",
  "BON": "BONE",
  "NAT": "NATURAL",
  "CAM": "CAMEL",
  "CAR": "CARAMEL",
  "BUR": "BURGUNDY",
  "WIN": "WINE",
  "PEW": "PEWTER",
  "MUL": "MULTI",
  "LOG": "LOGO",
};

let supabase;
let products = [];

async function init() {
  console.log("\n🔧 FIX SHOES & CLOTHES - SMART COLOR MATCHING\n");
  
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, modelRef, color, imageUrl, gallery, subcategory")
    .in("subcategory", ["נעל", "ביגוד"]);

  if (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }

  products = data;
  console.log(`✅ ${products.length} produits chargés (נעל + ביגוד)\n`);
}

function scanImages(dir, images = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanImages(fullPath, images);
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        images.push({ fullPath, fileName: entry.name, relativePath: path.relative(IMAGES_ROOT, fullPath) });
      }
    }
  } catch (e) {}
  return images;
}

function parseFilename(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName)).toUpperCase();
  
  let parts;
  if (baseName.includes("-")) {
    parts = baseName.split("-");
  } else if (baseName.includes("_")) {
    parts = baseName.split("_");
  }
  
  if (parts && parts.length >= 2) {
    const modelRef = parts[0].trim();
    let colorCode = parts[1].trim();
    
    // Extract color prefix (first 3 letters) - e.g., "DGR01" → "DGR"
    const colorPrefix = colorCode.replace(/[0-9]/g, "").substring(0, 3);
    
    return { modelRef, colorCode, colorPrefix };
  }
  return null;
}

function matchColor(colorPrefix, productColor) {
  const productColorUpper = productColor.toUpperCase();
  
  // Get the mapped color name
  const mappedColor = COLOR_CODE_MAP[colorPrefix];
  
  if (mappedColor) {
    // Check if product color contains the mapped color
    if (productColorUpper.includes(mappedColor)) {
      return true;
    }
  }
  
  // Also try direct prefix match
  if (productColorUpper.startsWith(colorPrefix)) {
    return true;
  }
  
  return false;
}

async function uploadImage(imageInfo) {
  try {
    const fileBuffer = fs.readFileSync(imageInfo.fullPath);
    const storagePath = imageInfo.relativePath.replace(/\\/g, "/");
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, { contentType: "image/jpeg", upsert: true });

    if (error && !error.message.includes("already exists")) {
      return { success: false };
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return { success: true, url: data.publicUrl };
  } catch (err) {
    return { success: false };
  }
}

async function main() {
  await init();

  console.log("📂 Scan des images...");
  const allImages = scanImages(IMAGES_ROOT);
  console.log(`✅ ${allImages.length} images trouvées\n`);

  // Create product lookup maps
  const productsByModelRef = new Map();
  for (const p of products) {
    const key = p.modelRef.toUpperCase();
    if (!productsByModelRef.has(key)) {
      productsByModelRef.set(key, []);
    }
    productsByModelRef.get(key).push(p);
  }

  console.log(`📊 ${productsByModelRef.size} modelRef uniques\n`);

  // Group images by modelRef + colorPrefix
  const imageGroups = new Map();
  
  for (const img of allImages) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) continue;
    
    // Only process if modelRef exists in our products
    if (!productsByModelRef.has(parsed.modelRef)) continue;
    
    const key = `${parsed.modelRef}|${parsed.colorPrefix}`;
    if (!imageGroups.has(key)) {
      imageGroups.set(key, { 
        modelRef: parsed.modelRef, 
        colorPrefix: parsed.colorPrefix, 
        images: [] 
      });
    }
    imageGroups.get(key).images.push(img);
  }

  console.log(`🖼️  ${imageGroups.size} groupes modelRef+couleur trouvés\n`);
  console.log("🚀 Upload et matching en cours...\n");

  let matched = 0;
  let uploaded = 0;
  let productsUpdated = 0;

  for (const [key, group] of imageGroups) {
    const { modelRef, colorPrefix, images } = group;
    
    // Find products with this modelRef
    const candidates = productsByModelRef.get(modelRef) || [];
    
    // Find products matching the color
    const matchedProducts = candidates.filter(p => matchColor(colorPrefix, p.color));
    
    if (matchedProducts.length === 0) {
      // No color match - skip
      continue;
    }

    matched++;

    // Upload images
    const uploadedUrls = [];
    for (const img of images) {
      const result = await uploadImage(img);
      if (result.success) {
        uploadedUrls.push(result.url);
        uploaded++;
      }
    }

    if (uploadedUrls.length === 0) continue;

    // Update matched products - IGNORE existing gallery (start fresh)
    for (const product of matchedProducts) {
      // Don't merge with existing - replace completely
      const newGallery = uploadedUrls;
      const newImageUrl = uploadedUrls[0];

      // Use modelRef + color as unique key (id is "GUESS" for all!)
      const { error } = await supabase
        .from("products")
        .update({ imageUrl: newImageUrl, gallery: newGallery })
        .eq("modelRef", product.modelRef)
        .eq("color", product.color);

      if (!error) {
        productsUpdated++;
        console.log(`✅ ${product.modelRef} | ${colorPrefix}→${product.color} | ${uploadedUrls.length} imgs`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`Groupes matchés:     ${matched}`);
  console.log(`Images uploadées:    ${uploaded}`);
  console.log(`Produits mis à jour: ${productsUpdated}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
