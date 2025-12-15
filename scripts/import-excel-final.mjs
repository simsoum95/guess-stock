import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables d'environnement manquantes!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Normaliser
function norm(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase();
}

// Parsing intelligent des nombres
function parseNumberIntelligent(value, isDecimal = false) {
  if (value === null || value === undefined || value === "") return 0;
  
  let cleaned = String(value).trim().replace(/\s/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    cleaned = isDecimal ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (hasDot && !isDecimal) {
    cleaned = cleaned.replace(/\./g, "");
  }
  
  const parsed = isDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

// Normaliser catégorie depuis sous-catégorie
function normalizeCategoryFromSubcategory(subcat) {
  if (!subcat) return "תיק";
  const normalized = subcat.trim();
  
  const mapping = {
    "תיק": "תיק", "תיק צד": "תיק", "תיק נשיאה": "תיק", "תיק גב": "תיק",
    "תיק נסיעות": "תיק", "תיק ערב": "תיק", "ארנקים": "תיק", "מזוודות": "תיק", "מחזיק מפתחות": "תיק",
    "נעל": "נעל", "נעליים שטוחו": "נעל", "נעלי עקב": "נעל", "סניקרס": "נעל",
    "כפכפים": "נעל", "סנדלים": "נעל", "מגפיים": "נעל",
    "ביגוד": "ביגוד", "טישירט": "ביגוד", "סווטשירט": "ביגוד", "חולצות": "ביגוד",
    "טופים": "ביגוד", "ג'קטים ומעיל": "ביגוד", "ג'ינסים": "ביגוד", "מכנסיים": "ביגוד",
    "מכנסי טרנינג": "ביגוד", "חצאיות": "ביגוד", "שמלות ואוברו": "ביגוד",
    "צעיפים": "ביגוד", "כובעים": "ביגוד", "סט new born": "ביגוד", "סט NEW BORN": "ביגוד",
  };
  
  if (mapping[normalized]) return mapping[normalized];
  if (normalized.startsWith("תיק")) return "תיק";
  if (normalized.startsWith("נעל")) return "נעל";
  if (normalized.startsWith("ביגוד")) return "ביגוד";
  
  const lower = normalized.toLowerCase();
  if (lower.includes("ארנק") || lower.includes("מזווד") || lower.includes("מחזיק מפתחות")) return "תיק";
  if (lower.includes("סניקר") || lower.includes("כפכף") || lower.includes("סנדל") || lower.includes("מגפ")) return "נעל";
  if (lower.includes("טישירט") || lower.includes("סווטשירט") || lower.includes("חולצ") || 
      lower.includes("ג'קט") || lower.includes("ג'ינס") || lower.includes("מכנס") || 
      lower.includes("חצאית") || lower.includes("שמלה") || lower.includes("צעיף") || 
      lower.includes("כובע") || lower.includes("new born")) return "ביגוד";
  
  return "תיק";
}

// Détecter les colonnes
function detectColumns(columns) {
  const lower = columns.map(c => c.toLowerCase().trim());
  
  return {
    id: columns.find((c, i) => ["id", "מזהה", "מק\"ט מלא", "מק״ט מלא"].includes(lower[i])) || null,
    modelRef: columns.find((c, i) => ["modelref", "model_ref", "model", "מק״ט", "מק\"ט", "ref", "קוד גם", "קוד"].includes(lower[i])) || null,
    color: columns.find((c, i) => ["color", "colour", "צבע"].includes(lower[i])) || null,
    stockQuantity: columns.find((c, i) => ["stockquantity", "stock_quantity", "stock", "מלאי", "quantity", "כמות מלאי נוכחי", "כמות"].includes(lower[i])) || null,
    priceWholesale: columns.find((c, i) => ["pricewholesale", "price_wholesale", "wholesale", "מחיר סיטונאי", "סיטונאי"].includes(lower[i])) || null,
    priceRetail: columns.find((c, i) => ["priceretail", "price_retail", "retail", "מחיר קמעונאי", "מחיר כולל מע\"מ בסיס", "מחיר כולל מע״מ בסיס", "מחיר"].includes(lower[i])) || null,
    brand: columns.find((c, i) => ["brand", "מותג"].includes(lower[i])) || null,
    subcategory: columns.find((c, i) => ["subcategory", "category", "קטגוריה", "תת משפחה", "תת-משפחה"].includes(lower[i])) || null,
    collection: columns.find((c, i) => ["collection", "קולקציה"].includes(lower[i])) || null,
    supplier: columns.find((c, i) => ["supplier", "ספק"].includes(lower[i])) || null,
    gender: columns.find((c, i) => ["gender", "מגדר"].includes(lower[i])) || null,
  };
}

async function importExcel(filePath) {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("📥 IMPORT PROPRE DEPUIS EXCEL");
  console.log("=".repeat(60));
  console.log();

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier non trouvé: ${filePath}`);
    return;
  }

  try {
    // Lire le fichier
    const workbook = XLSX.readFile(filePath);
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`📋 Feuilles: ${workbook.SheetNames.join(", ")}`);
    console.log();

    // Lire toutes les feuilles
    const allRows = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      console.log(`📄 Feuille "${sheetName}": ${rows.length} lignes`);
      allRows.push(...rows);
    }

    console.log(`📊 Total lignes: ${allRows.length}`);
    console.log();

    if (allRows.length === 0) {
      console.error("❌ Aucune donnée trouvée!");
      return;
    }

    // Détecter les colonnes
    const columns = Object.keys(allRows[0]);
    const detected = detectColumns(columns);

    console.log("🔍 Colonnes détectées:");
    console.log(`   ID: ${detected.id || "❌"}`);
    console.log(`   modelRef: ${detected.modelRef || "❌"}`);
    console.log(`   color: ${detected.color || "❌"}`);
    console.log(`   stockQuantity: ${detected.stockQuantity || "❌"}`);
    console.log(`   priceWholesale: ${detected.priceWholesale || "❌"}`);
    console.log(`   priceRetail: ${detected.priceRetail || "❌"}`);
    console.log();

    if (!detected.modelRef || !detected.color) {
      console.error("❌ Colonnes obligatoires manquantes: modelRef et color");
      return;
    }

    // Traiter chaque ligne
    let inserted = 0;
    let errors = 0;
    const errorDetails = [];
    const batch = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const rowNum = i + 2;

      // Extraire les valeurs
      const id = detected.id ? String(row[detected.id] || "").trim() : null;
      const modelRef = String(row[detected.modelRef] || "").trim();
      const color = String(row[detected.color] || "").trim();

      if (!modelRef || !color) {
        errors++;
        errorDetails.push({ row: rowNum, error: "modelRef ou color manquant" });
        continue;
      }

      // Parser les valeurs avec validation
      const stockQuantity = Math.max(0, Math.min(10000, parseNumberIntelligent(
        detected.stockQuantity ? row[detected.stockQuantity] : 0, false
      )));
      
      const priceWholesale = Math.max(0, Math.min(100000, parseNumberIntelligent(
        detected.priceWholesale ? row[detected.priceWholesale] : 0, true
      )));
      
      const priceRetail = Math.max(0, Math.min(100000, parseNumberIntelligent(
        detected.priceRetail ? row[detected.priceRetail] : 0, true
      )));

      const subcategory = detected.subcategory ? String(row[detected.subcategory] || "").trim() : "תיק";
      const category = normalizeCategoryFromSubcategory(subcategory);

      const product = {
        id: id || `${modelRef}-${color}-${Date.now()}-${i}`,
        modelRef,
        color,
        stockQuantity,
        priceWholesale,
        priceRetail,
        brand: detected.brand ? String(row[detected.brand] || "").trim() : "GUESS",
        subcategory,
        category,
        collection: detected.collection ? String(row[detected.collection] || "").trim() : "",
        supplier: detected.supplier ? String(row[detected.supplier] || "").trim() : "",
        gender: detected.gender ? String(row[detected.gender] || "").trim() : "Women",
        imageUrl: "/images/default.png",
        gallery: [],
        productName: modelRef,
      };

      batch.push(product);

      // Insérer par batch
      if (batch.length >= BATCH_SIZE) {
        const { error: batchError } = await supabase.from("products").insert(batch);
        if (batchError) {
          console.error(`❌ Erreur batch ${Math.floor(i / BATCH_SIZE)}:`, batchError.message);
          errors += batch.length;
        } else {
          inserted += batch.length;
          console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE)}: ${batch.length} produits insérés`);
        }
        batch.length = 0;
      }
    }

    // Insérer le dernier batch
    if (batch.length > 0) {
      const { error: batchError } = await supabase.from("products").insert(batch);
      if (batchError) {
        console.error(`❌ Erreur dernier batch:`, batchError.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`✅ Dernier batch: ${batch.length} produits insérés`);
      }
    }

    console.log();
    console.log("=".repeat(60));
    console.log("📊 RÉSUMÉ:");
    console.log("=".repeat(60));
    console.log();
    console.log(`✅ Insérés: ${inserted}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log();

    if (errorDetails.length > 0 && errorDetails.length <= 20) {
      console.log("Détails des erreurs:");
      errorDetails.forEach(e => {
        console.log(`   Ligne ${e.row}: ${e.error}`);
      });
    }

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage: node scripts/import-excel-final.mjs <fichier-excel>");
    console.log();
    console.log("Exemples:");
    console.log("  node scripts/import-excel-final.mjs data/products.xlsx");
    return;
  }

  const filePath = args[0];
  await importExcel(filePath);
}

main().catch(console.error);



