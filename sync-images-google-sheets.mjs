/**
 * =============================================================
 * SYNC SUPABASE IMAGES WITH GOOGLE SHEETS PRODUCTS
 * =============================================================
 * 
 * This script:
 * 1. Fetches all products from Google Sheets
 * 2. For each product, finds matching images in Supabase by modelRef + color
 * 3. Updates Supabase products table with images (creates entries if needed)
 * 
 * Run with: npm run sync-images
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import fetch functions (inline version for script)
async function fetchProductsFromGoogleSheet() {
  const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Sheet1";
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID not set");
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEET_NAME)}`;
  const response = await fetch(csvUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function mapSheetRowToProduct(row, index) {
  const getValue = (keys) => {
    for (const key of keys) {
      const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
      if (value !== undefined && value !== null && value !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const getNumber = (keys) => {
    const value = getValue(keys);
    if (!value) return 0;
    const cleaned = value.replace(/₪/g, "").replace(/\s+/g, "").replace(/,/g, ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const modelRef = getValue(["קוד גם", "קוד דגם", "modelRef"]);
  const color = getValue(["צבע", "color"]);
  const subcategory = getValue(["תת משפחה", "subcategory"]);
  
  let category = "ביגוד";
  const subLower = subcategory.toLowerCase();
  if (subLower.includes("כפכפים") || subLower.includes("נעל")) {
    category = "נעל";
  } else if (subLower.includes("תיק")) {
    category = "תיק";
  }

  return {
    id: `${modelRef}-${color}-${index}`,
    collection: getValue(["קולקציה", "collection"]),
    category: category,
    subcategory: subcategory,
    brand: getValue(["מותג", "brand"]),
    modelRef: modelRef,
    gender: getValue(["מגדר", "gender"]),
    supplier: getValue(["ספק", "supplier"]),
    color: color,
    priceRetail: getNumber(["מחיר כולל מע\"מ בסיס", "priceRetail"]),
    priceWholesale: getNumber(["סיטונאי", "priceWholesale"]),
    stockQuantity: getNumber(["כמות מלאי נוכחי", "stockQuantity"]),
    productName: getValue(["שם מוצר", "productName"]) || modelRef,
    size: getValue(["מידה", "size"]),
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Sheet1";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.upload");
  process.exit(1);
}

if (!GOOGLE_SHEET_ID) {
  console.error("❌ Missing GOOGLE_SHEET_ID in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const log = {
  info: (msg) => console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
};

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 SYNCHRONISATION IMAGES SUPABASE ↔ GOOGLE SHEETS");
  console.log("=".repeat(60) + "\n");

  // Step 1: Fetch products from Google Sheets
  log.info("Fetching products from Google Sheets...");
  const sheetRows = await fetchProductsFromGoogleSheet();
  log.success(`Found ${sheetRows.length} products in Google Sheets\n`);

  // Step 2: Map to product structure
  const googleProducts = sheetRows.map((row, index) => mapSheetRowToProduct(row, index));
  
  // Step 3: Fetch existing images from Supabase
  log.info("Fetching existing images from Supabase...");
  const { data: supabaseProducts, error: fetchError } = await supabase
    .from("products")
    .select("modelRef, color, imageUrl, gallery");

  if (fetchError) {
    log.error(`Failed to fetch Supabase products: ${fetchError.message}`);
    process.exit(1);
  }

  log.success(`Found ${supabaseProducts?.length || 0} products with images in Supabase\n`);

  // Create lookup map for Supabase images (by modelRef + color)
  const imageMap = new Map();
  supabaseProducts?.forEach(p => {
    const key = `${p.modelRef}|${p.color}`.toUpperCase();
    imageMap.set(key, {
      imageUrl: p.imageUrl,
      gallery: p.gallery || [],
    });
  });

  // Step 4: Process each Google Sheets product
  log.info("Synchronizing images...\n");
  
  let stats = {
    updated: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (let i = 0; i < googleProducts.length; i++) {
    const product = googleProducts[i];
    const key = `${product.modelRef}|${product.color}`.toUpperCase();
    const images = imageMap.get(key);

    if (!images || !images.imageUrl || images.imageUrl.includes("default")) {
      // No images for this product
      stats.skipped++;
      if ((i + 1) % 100 === 0) {
        log.info(`Processed ${i + 1}/${googleProducts.length}...`);
      }
      continue;
    }

    // Check if product exists in Supabase
    const { data: existing, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("modelRef", product.modelRef)
      .eq("color", product.color)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      log.warning(`Error checking product ${product.modelRef} ${product.color}: ${checkError.message}`);
      stats.errors++;
      continue;
    }

    if (existing) {
      // Update existing product
      const { error: updateError } = await supabase
        .from("products")
        .update({
          imageUrl: images.imageUrl,
          gallery: images.gallery,
          // Keep other fields from Google Sheets
          modelRef: product.modelRef,
          color: product.color,
          subcategory: product.subcategory,
          brand: product.brand,
        })
        .eq("id", existing.id);

      if (updateError) {
        log.warning(`Failed to update ${product.modelRef} ${product.color}: ${updateError.message}`);
        stats.errors++;
      } else {
        stats.updated++;
      }
    } else {
      // Create new product entry (only for images - data comes from Google Sheets)
      const { error: insertError } = await supabase
        .from("products")
        .insert({
          id: `${product.modelRef}-${product.color}-${Date.now()}`,
          modelRef: product.modelRef,
          color: product.color,
          imageUrl: images.imageUrl,
          gallery: images.gallery,
          subcategory: product.subcategory,
          brand: product.brand,
          // Set defaults for other fields
          category: product.category || "תיק",
          collection: product.collection || "",
          supplier: product.supplier || "",
          gender: product.gender || "",
          priceRetail: product.priceRetail || 0,
          priceWholesale: product.priceWholesale || 0,
          stockQuantity: product.stockQuantity || 0,
          productName: product.productName || product.modelRef,
        });

      if (insertError) {
        log.warning(`Failed to create ${product.modelRef} ${product.color}: ${insertError.message}`);
        stats.errors++;
      } else {
        stats.created++;
      }
    }

    if ((i + 1) % 100 === 0) {
      log.info(`Processed ${i + 1}/${googleProducts.length}... (${stats.updated} updated, ${stats.created} created)`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`Produits traités:     ${googleProducts.length}`);
  console.log(`Mis à jour:           ${stats.updated}`);
  console.log(`Créés:                ${stats.created}`);
  console.log(`Sans images:          ${stats.skipped}`);
  console.log(`Erreurs:              ${stats.errors}`);
  console.log("=".repeat(60) + "\n");

  log.success("Synchronisation terminée !");
}

main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

