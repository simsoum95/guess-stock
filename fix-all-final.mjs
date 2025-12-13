/**
 * SCRIPT FINAL - Fix ALL product images
 * Format fichiers: MODELREF_COLORCODE_NAME_VIEW.jpg (avec _)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";

// Mapping complet des codes couleur
const COLOR_MAP = {
  // Basic colors
  "BLA": "BLACK", "BLK": "BLACK", "BLA01": "BLACK", "BLK01": "BLACK",
  "WHI": "WHITE", "WHT": "WHITE", "WHI01": "WHITE",
  "IVO": "IVORY",
  
  // Grays
  "GRY": "GRAY", "GRE": "GRAY",
  "DGR": "DARK GRAY", "DGY": "DARK GRAY",
  "LGR": "LIGHT GRAY", "LGY": "LIGHT GRAY",
  "CLO": "COAL",
  "CHA": "CHARCOAL",
  
  // Browns
  "BRO": "BROWN", "BRN": "BROWN",
  "DBR": "DARK BROWN",
  "LBR": "LIGHT BROWN",
  "MBR": "MEDIUM BROWN",
  "COG": "COGNAC",
  "CAM": "CAMEL",
  "TAU": "TAUPE", "TAP": "TAUPE",
  "TAN": "TAN",
  
  // Naturals / Beiges
  "NAT": "NATURAL", "NAD": "NATURAL",
  "LNT": "LIGHT NATURAL",
  "MNT": "MEDIUM NATURAL",
  "DNT": "DARK NATURAL",
  "BGE": "BEIGE", "BEI": "BEIGE", "BSG": "BEIGE",
  "CRM": "CREAM", "CRE": "CREAM",
  "VAN": "VANILLA", "VNO": "VANILLA",
  "LAT": "LATTE", "LTL": "LATTE", "LTE": "LATTE",
  "BON": "BONE",
  "NUD": "NUDE",
  
  // Blues
  "BLU": "BLUE",
  "DBL": "DARK BLUE",
  "LBL": "LIGHT BLUE",
  "MBL": "MEDIUM BLUE",
  "NAV": "NAVY",
  "TEA": "TEAL",
  
  // Reds / Pinks
  "RED": "RED",
  "DRD": "DARK RED",
  "WIN": "WINE",
  "BUR": "BURGUNDY",
  "PNK": "PINK", "PIN": "PINK",
  "ROS": "ROSE",
  "BLS": "BLUSH",
  "COR": "CORAL",
  "CHE": "CHERRY", "BCH": "BLACK CHERRY",
  
  // Greens
  "GRN": "GREEN",
  "LGN": "LIGHT GREEN",
  "DGN": "DARK GREEN",
  "OLI": "OLIVE",
  "SAG": "SAGE",
  "MIN": "MINT",
  
  // Yellows / Oranges
  "YEL": "YELLOW",
  "ORG": "ORANGE", "ORA": "ORANGE",
  "GOL": "GOLD", "GLD": "GOLD",
  "AMB": "AMBER",
  
  // Metals
  "SLV": "SILVER", "SIL": "SILVER",
  "PEW": "PEWTER",
  "COP": "COPPER",
  "BRZ": "BRONZE",
  
  // Others
  "PUR": "PURPLE",
  "LAV": "LAVENDER",
  "LIL": "LILAC",
  "MUL": "MULTI",
  "LOG": "LOGO",
  "ESL": "ESPRESSO",
  "MOC": "MOCHA",
  "STO": "STONE",
  "SAN": "SAND",
  "ASH": "ASH",
  "SMO": "SMOKE",
  "GLA": "GLACIER",
  "OFF": "OFF WHITE",
  "LIS": "LISTO",
};

let supabase;

async function init() {
  console.log("\n🔧 SCRIPT FINAL - FIX ALL IMAGES\n");
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadProducts() {
  const all = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("modelRef, color, imageUrl, gallery, subcategory")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
  }
  return all;
}

function scanImages(dir, images = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanImages(fullPath, images);
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        images.push({ 
          fullPath, 
          fileName: entry.name, 
          relativePath: path.relative(IMAGES_ROOT, fullPath) 
        });
      }
    }
  } catch (e) {}
  return images;
}

function parseFilename(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName)).toUpperCase();
  
  // Try both _ and - separators
  let parts;
  if (baseName.includes("_")) {
    parts = baseName.split("_");
  } else if (baseName.includes("-")) {
    parts = baseName.split("-");
  }
  
  if (parts && parts.length >= 2) {
    const modelRef = parts[0].trim();
    const colorCode = parts[1].trim().replace(/[0-9]/g, ""); // Remove numbers
    return { modelRef, colorCode };
  }
  return null;
}

function matchesColor(colorCode, productColor) {
  const prodUpper = productColor.toUpperCase();
  
  // Direct match
  if (prodUpper.includes(colorCode)) return true;
  
  // Via mapping
  const mapped = COLOR_MAP[colorCode];
  if (mapped && prodUpper.includes(mapped)) return true;
  
  // First word match
  const firstWord = prodUpper.split(/[\s\/\-]/)[0];
  if (firstWord.startsWith(colorCode.substring(0, 3))) return true;
  
  return false;
}

async function uploadImage(imageInfo) {
  try {
    const fileBuffer = fs.readFileSync(imageInfo.fullPath);
    const storagePath = imageInfo.relativePath.replace(/\\/g, "/");
    
    await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileBuffer, { 
      contentType: "image/jpeg", 
      upsert: true 
    });

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch {
    return null;
  }
}

async function main() {
  await init();

  console.log("📦 Chargement des produits...");
  const products = await loadProducts();
  console.log(`✅ ${products.length} produits\n`);

  // Only process products without images
  const productsWithoutImages = products.filter(p => 
    !p.imageUrl || p.imageUrl.includes("default")
  );
  console.log(`🎯 ${productsWithoutImages.length} produits SANS image à traiter\n`);

  console.log("📂 Scan des images...");
  const allImages = scanImages(IMAGES_ROOT);
  console.log(`✅ ${allImages.length} images\n`);

  // Group images by modelRef
  const imagesByModelRef = new Map();
  for (const img of allImages) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) continue;
    
    const key = parsed.modelRef;
    if (!imagesByModelRef.has(key)) {
      imagesByModelRef.set(key, []);
    }
    imagesByModelRef.get(key).push({ ...img, colorCode: parsed.colorCode });
  }

  console.log(`📊 ${imagesByModelRef.size} modelRef avec images\n`);
  console.log("🚀 Matching et upload...\n");

  let updated = 0;
  let uploaded = 0;
  let processed = 0;

  for (const product of productsWithoutImages) {
    processed++;
    
    const modelRefUpper = product.modelRef.toUpperCase();
    const images = imagesByModelRef.get(modelRefUpper);
    
    if (!images || images.length === 0) continue;

    // Find images matching this product's color
    let matchingImages = images.filter(img => matchesColor(img.colorCode, product.color));
    
    // If no color match, use first available image for this modelRef
    if (matchingImages.length === 0) {
      matchingImages = [images[0]];
    }

    // Upload images
    const urls = [];
    for (const img of matchingImages.slice(0, 6)) { // Max 6 images
      const url = await uploadImage(img);
      if (url) {
        urls.push(url);
        uploaded++;
      }
    }

    if (urls.length === 0) continue;

    // Update product using modelRef + color as key
    const { error } = await supabase
      .from("products")
      .update({ imageUrl: urls[0], gallery: urls })
      .eq("modelRef", product.modelRef)
      .eq("color", product.color);

    if (!error) {
      updated++;
    }

    if (processed % 50 === 0) {
      console.log(`📈 ${processed}/${productsWithoutImages.length} traités, ${updated} mis à jour`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ FINAL");
  console.log("=".repeat(60));
  console.log(`Produits traités:    ${processed}`);
  console.log(`Produits mis à jour: ${updated}`);
  console.log(`Images uploadées:    ${uploaded}`);
  console.log("=".repeat(60));

  // Final stats
  const { data: stats } = await supabase
    .from("products")
    .select("subcategory, imageUrl");
  
  const byCategory = {};
  for (const p of stats || []) {
    if (!byCategory[p.subcategory]) {
      byCategory[p.subcategory] = { total: 0, withImage: 0 };
    }
    byCategory[p.subcategory].total++;
    if (p.imageUrl && !p.imageUrl.includes("default")) {
      byCategory[p.subcategory].withImage++;
    }
  }

  console.log("\n📊 PAR CATÉGORIE:");
  for (const [cat, data] of Object.entries(byCategory)) {
    const pct = Math.round(data.withImage / data.total * 100);
    console.log(`  ${cat}: ${data.withImage}/${data.total} (${pct}%)`);
  }
}

main().catch(console.error);




