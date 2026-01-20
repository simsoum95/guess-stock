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

// Fonction pour normaliser les valeurs
function normalize(s) {
  if (!s) return "";
  return String(s).trim();
}

function norm(s) {
  return normalize(s).toLowerCase();
}

// Fonction pour parser un nombre strictement
function parseNumber(value, defaultValue = 0, maxValue = null) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  
  // Nettoyer la valeur
  const cleaned = String(value).trim().replace(/,/g, "").replace(/\s/g, "");
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }
  
  if (parsed < 0) {
    return 0;
  }
  
  if (maxValue !== null && parsed > maxValue) {
    console.warn(`⚠️  Valeur ${parsed} dépasse la limite ${maxValue}, limitée à ${maxValue}`);
    return maxValue;
  }
  
  return parsed;
}

// Fonction pour détecter les colonnes
function detectColumns(columns) {
  const lowerColumns = columns.map(c => c.toLowerCase().trim());
  
  return {
    id: columns.find((c, i) => 
      ['id', 'מזהה', 'מק"ט מלא', 'מק״ט מלא'].includes(lowerColumns[i])
    ) || null,
    modelRef: columns.find((c, i) => 
      ['modelref', 'model_ref', 'model', 'מק״ט', 'מק"ט', 'ref'].includes(lowerColumns[i])
    ) || null,
    color: columns.find((c, i) => 
      ['color', 'colour', 'צבע'].includes(lowerColumns[i])
    ) || null,
    stockQuantity: columns.find((c, i) => 
      ['stockquantity', 'stock_quantity', 'stock', 'מלאי', 'quantity'].includes(lowerColumns[i])
    ) || null,
    priceWholesale: columns.find((c, i) => 
      ['pricewholesale', 'price_wholesale', 'wholesale', 'מחיר סיטונאי', 'prix wholesale'].includes(lowerColumns[i])
    ) || null,
    priceRetail: columns.find((c, i) => 
      ['priceretail', 'price_retail', 'retail', 'מחיר קמעונאי', 'prix retail'].includes(lowerColumns[i])
    ) || null,
    brand: columns.find((c, i) => 
      ['brand', 'מותג'].includes(lowerColumns[i])
    ) || null,
    subcategory: columns.find((c, i) => 
      ['subcategory', 'category', 'קטגוריה'].includes(lowerColumns[i])
    ) || null,
    collection: columns.find((c, i) => 
      ['collection', 'קולקציה'].includes(lowerColumns[i])
    ) || null,
  };
}

async function importExcel(filePath, options = {}) {
  const { clearFirst = false, dryRun = false } = options;

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
    // Lire le fichier Excel
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
      console.error("❌ Aucune donnée trouvée dans le fichier!");
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

    // Vider la table si demandé
    if (clearFirst && !dryRun) {
      console.log("🗑️  Suppression de tous les produits existants...");
      const { error: deleteError } = await supabase.from("products").delete().neq("id", "NEVER_DELETE_THIS");
      if (deleteError) {
        console.error("❌ Erreur lors de la suppression:", deleteError.message);
        return;
      }
      console.log("✅ Table vidée");
      console.log();
    }

    // Traiter chaque ligne
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const rowNum = i + 2;

      const id = detected.id ? normalize(row[detected.id]) : null;
      const modelRef = normalize(row[detected.modelRef]);
      const color = normalize(row[detected.color]);

      if (!modelRef || !color) {
        errors++;
        errorDetails.push({ row: rowNum, error: "modelRef ou color manquant" });
        continue;
      }

      // Parser les valeurs
      const stockQuantity = parseNumber(row[detected.stockQuantity], 0, 10000);
      const priceWholesale = parseNumber(row[detected.priceWholesale], 0, 100000);
      const priceRetail = parseNumber(row[detected.priceRetail], 0, 100000);

      const product = {
        id: id || `${modelRef}-${color}-${Date.now()}-${i}`,
        modelRef,
        color,
        stockQuantity,
        priceWholesale,
        priceRetail,
        brand: detected.brand ? normalize(row[detected.brand]) : "GUESS",
        subcategory: detected.subcategory ? normalize(row[detected.subcategory]) : "תיק",
        category: detected.subcategory ? normalize(row[detected.subcategory]) : "תיק",
        collection: detected.collection ? normalize(row[detected.collection]) : "",
        gender: "Women",
        supplier: "",
        imageUrl: "/images/default.png",
        gallery: [],
        productName: modelRef,
      };

      if (dryRun) {
        console.log(`[DRY RUN] Ligne ${rowNum}: ${modelRef} / ${color} - Stock: ${stockQuantity}, Prix: ${priceWholesale}`);
      } else {
        // Vérifier si le produit existe
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("id", product.id)
          .single();

        if (existing) {
          // Mettre à jour
          const { error: updateError } = await supabase
            .from("products")
            .update(product)
            .eq("id", product.id);

          if (updateError) {
            errors++;
            errorDetails.push({ row: rowNum, error: updateError.message });
          } else {
            updated++;
          }
        } else {
          // Insérer
          const { error: insertError } = await supabase
            .from("products")
            .insert(product);

          if (insertError) {
            errors++;
            errorDetails.push({ row: rowNum, error: insertError.message });
          } else {
            inserted++;
          }
        }
      }
    }

    console.log();
    console.log("=".repeat(60));
    console.log("📊 RÉSUMÉ:");
    console.log("=".repeat(60));
    console.log();
    if (dryRun) {
      console.log("🔍 MODE DRY RUN - Aucune modification effectuée");
      console.log();
    }
    console.log(`✅ Insérés: ${inserted}`);
    console.log(`🔄 Mis à jour: ${updated}`);
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
    console.log("Usage: node scripts/import-excel-clean.mjs <fichier-excel> [options]");
    console.log();
    console.log("Options:");
    console.log("  --clear    : Vider la table avant l'import");
    console.log("  --dry-run  : Mode test (ne fait rien)");
    console.log();
    console.log("Exemples:");
    console.log("  node scripts/import-excel-clean.mjs data/products.xlsx");
    console.log("  node scripts/import-excel-clean.mjs data/products.xlsx --clear");
    console.log("  node scripts/import-excel-clean.mjs data/products.xlsx --dry-run");
    return;
  }

  const filePath = args[0];
  const clearFirst = args.includes("--clear");
  const dryRun = args.includes("--dry-run");

  await importExcel(filePath, { clearFirst, dryRun });
}

main().catch(console.error);








