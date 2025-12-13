/**
 * =============================================================
 * SUPABASE IMAGE UPLOAD SCRIPT V2 - SMART COLOR MATCHING
 * =============================================================
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;
const BUCKET_NAME = "guess-images";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// =============================================================
// COLOR ABBREVIATION MAPPING
// =============================================================
const COLOR_MAP = {
  // Standard abbreviations
  "BLA": ["BLACK", "BLA"],
  "BLK": ["BLACK", "BLA"],
  "WHI": ["WHITE", "WHI"],
  "WHT": ["WHITE", "WHI"],
  "OFF": ["OFF WHITE", "OFF"],
  "BRO": ["BROWN", "BRO"],
  "BRN": ["BROWN", "BRO"],
  "BEI": ["BEIGE", "BEI"],
  "RED": ["RED", "CLARET", "CHERRY"],
  "BLU": ["BLUE", "BLU"],
  "GRE": ["GREEN", "GRE", "GRAY", "GREY"],
  "GRY": ["GRAY", "GREY", "GRE"],
  "NAV": ["NAVY", "NAV"],
  "PIN": ["PINK", "PIN"],
  "PUR": ["PURPLE", "PUR"],
  "YEL": ["YELLOW", "YEL"],
  "ORG": ["ORANGE", "ORG"],
  "GOL": ["GOLD", "GOL"],
  "SIL": ["SILVER", "SIL"],
  "CRE": ["CREAM", "CRE"],
  "IVO": ["IVORY", "IVO"],
  "TAN": ["TAN"],
  "CAM": ["CAMEL", "CAM", "CARAMEL"],
  "CAR": ["CARAMEL", "CAR", "CAMEL"],
  "COG": ["COGNAC", "COG"],
  "COA": ["COAL", "COA"],
  "CHA": ["CHARCOAL", "CHA"],
  "BON": ["BONE", "BON"],
  "NAT": ["NATURAL", "NAT"],
  "NAD": ["NATURAL", "NAT"],  // NAD = NATURAL
  "NRC": ["NATURAL", "NAT"],  // NRC variant
  "NTB": ["NATURAL", "NAT"],  // NTB variant  
  "NML": ["NATURAL", "NAT"],  // NML variant
  "LIS": ["LISTO", "LIS"],
  "AMB": ["AMBER", "AMB"],
  "AME": ["AMETHYST", "AME"],
  "APR": ["APRICOT", "APR"],
  "BUR": ["BURGUNDY", "BUR"],
  "CHE": ["CHERRY", "CHE"],
  "CHO": ["CHOCOLATE", "CHO"],
  "CIN": ["CINNAMON", "CIN"],
  "COR": ["CORAL", "COR"],
  "FUC": ["FUCHSIA", "FUC"],
  "LAV": ["LAVENDER", "LAV"],
  "LIM": ["LIME", "LIM"],
  "MAG": ["MAGENTA", "MAG"],
  "MAR": ["MAROON", "MAR"],
  "MUS": ["MUSTARD", "MUS"],
  "OLI": ["OLIVE", "OLI"],
  "PEA": ["PEACH", "PEA"],
  "PLU": ["PLUM", "PLU"],
  "ROS": ["ROSE", "ROS"],
  "SAL": ["SALMON", "SAL"],
  "TAU": ["TAUPE", "TAU"],
  "TEA": ["TEAL", "TEA"],
  "TUR": ["TURQUOISE", "TUR"],
  "VIO": ["VIOLET", "VIO"],
  "WIN": ["WINE", "WIN"],
  "LOG": ["LOGO", "LOG"],
  "MUL": ["MULTI", "MUL"],
};

let supabase;
let allProducts = [];

// =============================================================
// INITIALIZATION
// =============================================================

async function init() {
  console.log("\n🖼️  SUPABASE IMAGE UPLOAD V2 - SMART MATCHING\n");
  console.log("=".repeat(60));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === "PASTE_SERVICE_ROLE_HERE") {
    console.error("❌ Configuration manquante dans .env.upload");
    process.exit(1);
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load ALL products into memory for faster matching
  console.log("📦 Chargement de tous les produits...");
  const { data, error } = await supabase.from("products").select("id, modelRef, color, imageUrl, gallery").range(0, 9999);
  
  if (error) {
    console.error("❌ Erreur Supabase:", error.message);
    process.exit(1);
  }

  allProducts = data;
  console.log(`✅ ${allProducts.length} produits chargés\n`);

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets.some(b => b.name === BUCKET_NAME)) {
    await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    console.log(`✅ Bucket '${BUCKET_NAME}' créé`);
  }
}

// =============================================================
// SMART COLOR MATCHING
// =============================================================

function normalizeColor(color) {
  return color.toUpperCase().trim();
}

function findMatchingProducts(modelRef, colorAbbrev) {
  const normalizedModelRef = modelRef.toUpperCase().trim();
  const normalizedColor = normalizeColor(colorAbbrev);

  // First filter by modelRef (case-insensitive)
  const modelMatches = allProducts.filter(p => 
    p.modelRef && p.modelRef.toUpperCase() === normalizedModelRef
  );

  if (modelMatches.length === 0) {
    return [];
  }

  // Try exact color match first
  let colorMatches = modelMatches.filter(p => 
    p.color && normalizeColor(p.color) === normalizedColor
  );

  if (colorMatches.length > 0) {
    return colorMatches;
  }

  // Try color starts with abbreviation
  colorMatches = modelMatches.filter(p => 
    p.color && normalizeColor(p.color).startsWith(normalizedColor)
  );

  if (colorMatches.length > 0) {
    return colorMatches;
  }

  // Try using color map
  const mappedColors = COLOR_MAP[normalizedColor] || [];
  for (const mappedColor of mappedColors) {
    colorMatches = modelMatches.filter(p => 
      p.color && normalizeColor(p.color).includes(mappedColor.toUpperCase())
    );
    if (colorMatches.length > 0) {
      return colorMatches;
    }
  }

  // Try partial match - if color in DB contains the abbreviation
  colorMatches = modelMatches.filter(p => 
    p.color && normalizeColor(p.color).includes(normalizedColor)
  );

  if (colorMatches.length > 0) {
    return colorMatches;
  }

  // Try reverse - if abbreviation is in any word of the color
  colorMatches = modelMatches.filter(p => {
    if (!p.color) return false;
    const words = normalizeColor(p.color).split(/[\s\/\-]+/);
    return words.some(word => word.startsWith(normalizedColor) || normalizedColor.startsWith(word.substring(0, 3)));
  });

  if (colorMatches.length > 0) {
    return colorMatches;
  }

  // Last resort: return all products with this modelRef (color mismatch warning)
  // This ensures we don't lose images for existing products
  return modelMatches.map(p => ({ ...p, colorMismatch: true }));
}

// =============================================================
// FILE SCANNING & PARSING
// =============================================================

function scanImages(dir, images = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanImages(fullPath, images);
    } else if (IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      images.push({ fullPath, fileName: entry.name, relativePath: path.relative(IMAGES_ROOT, fullPath) });
    }
  }
  return images;
}

function parseFilename(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  
  // Try dash format: MODELREF-COLOR-ANYTHING
  if (baseName.includes("-")) {
    const parts = baseName.split("-");
    if (parts.length >= 2) {
      return { modelRef: parts[0].trim().toUpperCase(), color: parts[1].trim().toUpperCase() };
    }
  }
  
  // Try underscore format: MODELREF_COLOR_ANYTHING
  if (baseName.includes("_")) {
    const parts = baseName.split("_");
    if (parts.length >= 2) {
      return { modelRef: parts[0].trim().toUpperCase(), color: parts[1].trim().toUpperCase() };
    }
  }

  return null;
}

// =============================================================
// UPLOAD & UPDATE
// =============================================================

async function uploadImage(imageInfo) {
  try {
    const fileBuffer = fs.readFileSync(imageInfo.fullPath);
    const storagePath = imageInfo.relativePath.replace(/\\/g, "/");
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, { contentType: "image/jpeg", upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return { success: true, url: data.publicUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function updateProduct(productId, imageUrl, gallery) {
  const { error } = await supabase
    .from("products")
    .update({ imageUrl, gallery })
    .eq("id", productId);
  return !error;
}

// =============================================================
// MAIN
// =============================================================

async function main() {
  await init();

  console.log(`📂 Scan du dossier: ${IMAGES_ROOT}`);
  const images = scanImages(IMAGES_ROOT);
  console.log(`✅ ${images.length} images trouvées\n`);

  // Group images by product
  const productImages = new Map();
  let parseErrors = 0;

  for (const img of images) {
    const parsed = parseFilename(img.fileName);
    if (!parsed) {
      parseErrors++;
      continue;
    }
    const key = `${parsed.modelRef}|${parsed.color}`;
    if (!productImages.has(key)) {
      productImages.set(key, { ...parsed, images: [] });
    }
    productImages.get(key).images.push(img);
  }

  console.log(`📊 ${productImages.size} groupes (modelRef+color) identifiés`);
  console.log(`⚠️  ${parseErrors} fichiers non parsables\n`);
  console.log("=".repeat(60));
  console.log("🚀 Démarrage de l'upload...\n");

  const stats = {
    matched: 0,
    matchedWithMismatch: 0,
    notFound: 0,
    uploaded: 0,
    failed: 0,
    updated: 0,
  };

  const notFound = [];
  let processed = 0;

  for (const [key, data] of productImages) {
    processed++;
    const { modelRef, color, images: imgs } = data;

    // Find matching products
    const matches = findMatchingProducts(modelRef, color);

    if (matches.length === 0) {
      stats.notFound++;
      notFound.push({ modelRef, color, count: imgs.length });
      continue;
    }

    const hasColorMismatch = matches.some(m => m.colorMismatch);
    if (hasColorMismatch) {
      stats.matchedWithMismatch++;
    } else {
      stats.matched++;
    }

    // Upload images
    const uploadedUrls = [];
    for (const img of imgs) {
      const result = await uploadImage(img);
      if (result.success) {
        uploadedUrls.push(result.url);
        stats.uploaded++;
      } else {
        stats.failed++;
      }
    }

    if (uploadedUrls.length === 0) continue;

    // Update all matching products
    for (const product of matches) {
      const existingGallery = product.gallery || [];
      const newGallery = [...new Set([...existingGallery, ...uploadedUrls])];
      const newImageUrl = product.imageUrl && !product.imageUrl.includes("default") 
        ? product.imageUrl 
        : uploadedUrls[0];

      if (await updateProduct(product.id, newImageUrl, newGallery)) {
        stats.updated++;
      }
    }

    // Progress indicator
    if (processed % 100 === 0) {
      console.log(`📈 Progression: ${processed}/${productImages.size} (${Math.round(processed/productImages.size*100)}%)`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ FINAL");
  console.log("=".repeat(60));
  console.log(`Total images scannées:        ${images.length}`);
  console.log(`Groupes modelRef+color:       ${productImages.size}`);
  console.log(`Produits matchés (exact):     ${stats.matched}`);
  console.log(`Produits matchés (approx):    ${stats.matchedWithMismatch}`);
  console.log(`Produits non trouvés:         ${stats.notFound}`);
  console.log(`Images uploadées:             ${stats.uploaded}`);
  console.log(`Images échouées:              ${stats.failed}`);
  console.log(`Produits mis à jour:          ${stats.updated}`);
  console.log("=".repeat(60));

  if (notFound.length > 0 && notFound.length <= 50) {
    console.log("\n⚠️  Produits non trouvés:");
    notFound.slice(0, 30).forEach(p => console.log(`  - ${p.modelRef} | ${p.color} (${p.count} images)`));
    if (notFound.length > 30) console.log(`  ... et ${notFound.length - 30} autres`);
  }

  console.log("\n✅ Terminé!");
}

main().catch(err => {
  console.error("❌ Erreur fatale:", err.message);
  process.exit(1);
});




