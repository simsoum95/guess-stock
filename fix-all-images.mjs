/**
 * FIX ALL PRODUCT IMAGES
 * Smart color code mapping for ALL categories
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";

// COLOR CODE MAPPING
const COLOR_CODE_MAP = {
  "BLK": "BLACK", "BLA": "BLACK",
  "WHI": "WHITE", "WHT": "WHITE",
  "IVO": "IVORY",
  "DGR": "DARK GRAY", "DGY": "DARK GRAY",
  "LGR": "LIGHT GRAY", "LGY": "LIGHT GRAY",
  "DBL": "DARK BLUE", "LBL": "LIGHT BLUE",
  "DBR": "DARK BROWN", "LBR": "LIGHT BROWN", "MBR": "MEDIUM BROWN",
  "DRD": "DARK RED", "LRD": "LIGHT RED", "MRD": "MEDIUM RED",
  "DNT": "DARK NATURAL", "LNT": "LIGHT NATURAL", "MNT": "MEDIUM NATURAL",
  "GLD": "GOLD", "GOL": "GOLD",
  "SLV": "SILVER", "SIL": "SILVER",
  "BGE": "BEIGE", "BEI": "BEIGE",
  "CRM": "CREAM", "CRE": "CREAM",
  "TAN": "TAN", "TAU": "TAUPE",
  "NAV": "NAVY",
  "GRN": "GREEN", "GRE": "GREEN", "LGN": "LIGHT GREEN", "DGN": "DARK GREEN",
  "PNK": "PINK", "PIN": "PINK",
  "RED": "RED", "BLU": "BLUE",
  "ORG": "ORANGE", "ORA": "ORANGE",
  "YEL": "YELLOW",
  "PUR": "PURPLE",
  "COG": "COGNAC", "COA": "COAL", "CHA": "CHARCOAL",
  "BON": "BONE", "NAT": "NATURAL",
  "CAM": "CAMEL", "CAR": "CARAMEL",
  "BUR": "BURGUNDY", "WIN": "WINE",
  "PEW": "PEWTER",
  "MUL": "MULTI", "LOG": "LOGO",
  "JBL": "JET BLACK", "JET": "JET BLACK",
  "MOC": "MOCHA", "LAT": "LATTE",
  "ROS": "ROSE", "BLS": "BLUSH", "BLH": "BLUSH",
  "SAG": "SAGE", "MIN": "MINT",
  "COR": "CORAL", "PEA": "PEACH",
  "LAV": "LAVENDER", "LIL": "LILAC",
  "OLI": "OLIVE", "KHA": "KHAKI",
  "NUD": "NUDE", "FLE": "FLESH",
  "CHE": "CHERRY", "BCH": "BLACK CHERRY",
  "SAN": "SAND", "STO": "STONE",
  "ASH": "ASH", "SMO": "SMOKE",
  "COP": "COPPER", "BRO": "BRONZE", "BRZ": "BRONZE",
  "MAR": "MAROON", "PLU": "PLUM",
  "TEA": "TEAL", "TUR": "TURQUOISE",
  "AQU": "AQUA", "SKY": "SKY",
  "NRC": "NATURAL", "NTB": "NATURAL", "NML": "NATURAL", "NAD": "NATURAL",
  "OFF": "OFF WHITE",
  "LIS": "LISTO",
  "AMB": "AMBER", "AME": "AMETHYST",
};

let supabase;

async function init() {
  console.log("\n🔧 FIX ALL PRODUCT IMAGES - SMART MATCHING\n");
  
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadAllProducts() {
  const allProducts = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, modelRef, color, imageUrl, gallery, subcategory")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allProducts.push(...data);
    page++;
  }
  
  return allProducts;
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
    const colorPrefix = colorCode.replace(/[0-9]/g, "").substring(0, 3);
    
    return { modelRef, colorCode, colorPrefix };
  }
  return null;
}

function matchColor(colorPrefix, colorCode, productColor) {
  const productColorUpper = productColor.toUpperCase();
  
  // 1. Direct match with full color code
  if (productColorUpper.includes(colorCode)) return true;
  
  // 2. Match via color map
  const mappedColor = COLOR_CODE_MAP[colorPrefix];
  if (mappedColor && productColorUpper.includes(mappedColor)) return true;
  
  // 3. Prefix match on first word of product color
  const firstWord = productColorUpper.split(/[\s\/\-]/)[0];
  if (firstWord.startsWith(colorPrefix)) return true;
  
  // 4. Match numbers (e.g., "01" in "DGR01" matches "020" in "DARK GRAY 020")
  const codeNumbers = colorCode.match(/\d+/)?.[0];
  const productNumbers = productColor.match(/\d+/)?.[0];
  if (codeNumbers && productNumbers) {
    // "01" matches "010", "001", etc.
    if (productNumbers.includes(codeNumbers) || codeNumbers.includes(productNumbers.substring(0, codeNumbers.length))) {
      if (mappedColor && productColorUpper.includes(mappedColor)) return true;
    }
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

  // Reset all images first
  console.log("🗑️  Réinitialisation des images...");
  await supabase
    .from("products")
    .update({ imageUrl: "/images/default.png", gallery: null })
    .neq("id", "");
  console.log("✅ Images réinitialisées\n");

  console.log("📦 Chargement des produits...");
  const products = await loadAllProducts();
  console.log(`✅ ${products.length} produits chargés\n`);

  console.log("📂 Scan des images...");
  const allImages = scanImages(IMAGES_ROOT);
  console.log(`✅ ${allImages.length} images trouvées\n`);

  // Create product lookup by modelRef
  const productsByModelRef = new Map();
  for (const p of products) {
    const key = p.modelRef.toUpperCase();
    if (!productsByModelRef.has(key)) {
      productsByModelRef.set(key, []);
    }
    productsByModelRef.get(key).push(p);
  }

  console.log(`📊 ${productsByModelRef.size} modelRef uniques\n`);

  // Group images by modelRef + colorCode
  const imageGroups = new Map();
  
  for (const img of allImages) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) continue;
    
    if (!productsByModelRef.has(parsed.modelRef)) continue;
    
    const key = `${parsed.modelRef}|${parsed.colorCode}`;
    if (!imageGroups.has(key)) {
      imageGroups.set(key, { 
        modelRef: parsed.modelRef, 
        colorCode: parsed.colorCode,
        colorPrefix: parsed.colorPrefix, 
        images: [] 
      });
    }
    imageGroups.get(key).images.push(img);
  }

  console.log(`🖼️  ${imageGroups.size} groupes d'images à traiter\n`);
  console.log("🚀 Upload et matching en cours...\n");

  let matched = 0;
  let uploaded = 0;
  let productsUpdated = 0;
  let processedGroups = 0;

  for (const [key, group] of imageGroups) {
    processedGroups++;
    const { modelRef, colorCode, colorPrefix, images } = group;
    
    const candidates = productsByModelRef.get(modelRef) || [];
    const matchedProducts = candidates.filter(p => matchColor(colorPrefix, colorCode, p.color));
    
    if (matchedProducts.length === 0) continue;

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

    // Update matched products
    for (const product of matchedProducts) {
      const existingGallery = product.gallery || [];
      const newGallery = [...new Set([...existingGallery, ...uploadedUrls])];

      const { error } = await supabase
        .from("products")
        .update({ imageUrl: newGallery[0], gallery: newGallery })
        .eq("id", product.id);

      if (!error) {
        productsUpdated++;
      }
    }

    if (processedGroups % 100 === 0) {
      console.log(`📈 ${processedGroups}/${imageGroups.size} (${Math.round(processedGroups/imageGroups.size*100)}%)`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ FINAL");
  console.log("=".repeat(60));
  console.log(`Groupes traités:     ${processedGroups}`);
  console.log(`Groupes matchés:     ${matched}`);
  console.log(`Images uploadées:    ${uploaded}`);
  console.log(`Produits mis à jour: ${productsUpdated}`);
  console.log("=".repeat(60));
  
  // Final stats
  const { data: stats } = await supabase
    .from("products")
    .select("subcategory")
    .not("imageUrl", "like", "%default%");
  
  console.log(`\n✅ Produits avec images: ${stats?.length || 0} / ${products.length}`);
}

main().catch(console.error);

