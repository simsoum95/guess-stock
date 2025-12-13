import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

// Fonction pour analyser un fichier Excel
function analyzeExcelFile(filePath) {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("📊 ANALYSE DU FICHIER EXCEL");
  console.log("=".repeat(60));
  console.log();

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier non trouvé: ${filePath}`);
    return null;
  }

  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`📋 Nombre de feuilles: ${workbook.SheetNames.length}`);
    console.log();

    const allData = [];

    // Analyser chaque feuille
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      
      console.log(`📄 Feuille: "${sheetName}"`);
      console.log(`   Lignes: ${rows.length}`);
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        console.log(`   Colonnes (${columns.length}): ${columns.join(", ")}`);
        
        // Afficher les 3 premières lignes comme exemple
        console.log(`   Exemples de données:`);
        rows.slice(0, 3).forEach((row, idx) => {
          console.log(`     Ligne ${idx + 1}:`, JSON.stringify(row, null, 2).substring(0, 200));
        });
        console.log();
      }

      allData.push({
        sheetName,
        rows,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      });
    }

    return {
      filePath,
      sheets: allData,
      totalRows: allData.reduce((sum, s) => sum + s.rows.length, 0),
    };

  } catch (error) {
    console.error("❌ Erreur lors de la lecture:", error.message);
    return null;
  }
}

// Fonction pour détecter les colonnes importantes
function detectColumns(rows) {
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const detected = {
    id: null,
    modelRef: null,
    color: null,
    stockQuantity: null,
    priceWholesale: null,
    priceRetail: null,
  };

  // Chercher les colonnes par nom (insensible à la casse)
  const lowerColumns = columns.map(c => c.toLowerCase().trim());

  // ID
  detected.id = columns.find(c => 
    ['id', 'מזהה', 'מק"ט מלא', 'מק״ט מלא'].includes(c.toLowerCase().trim())
  ) || null;

  // modelRef
  detected.modelRef = columns.find(c => 
    ['modelref', 'model_ref', 'model', 'מק״ט', 'מק"ט', 'ref'].includes(c.toLowerCase().trim())
  ) || null;

  // color
  detected.color = columns.find(c => 
    ['color', 'colour', 'צבע'].includes(c.toLowerCase().trim())
  ) || null;

  // stockQuantity
  detected.stockQuantity = columns.find(c => 
    ['stockquantity', 'stock_quantity', 'stock', 'מלאי', 'quantity'].includes(c.toLowerCase().trim())
  ) || null;

  // priceWholesale
  detected.priceWholesale = columns.find(c => 
    ['pricewholesale', 'price_wholesale', 'wholesale', 'מחיר סיטונאי', 'prix wholesale'].includes(c.toLowerCase().trim())
  ) || null;

  // priceRetail
  detected.priceRetail = columns.find(c => 
    ['priceretail', 'price_retail', 'retail', 'מחיר קמעונאי', 'prix retail'].includes(c.toLowerCase().trim())
  ) || null;

  return { columns, detected };
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage: node scripts/analyze-excel-file.mjs <chemin-vers-fichier-excel>");
    console.log();
    console.log("Exemples:");
    console.log("  node scripts/analyze-excel-file.mjs data/products.xlsx");
    console.log("  node scripts/analyze-excel-file.mjs C:/Users/1/Desktop/products.xlsx");
    return;
  }

  const filePath = args[0];
  const result = analyzeExcelFile(filePath);

  if (result) {
    console.log("=".repeat(60));
    console.log("📊 RÉSUMÉ:");
    console.log("=".repeat(60));
    console.log();
    console.log(`Total lignes: ${result.totalRows}`);
    console.log(`Total feuilles: ${result.sheets.length}`);
    console.log();

    // Analyser chaque feuille pour détecter les colonnes
    result.sheets.forEach((sheet, idx) => {
      if (sheet.rows.length > 0) {
        const detection = detectColumns(sheet.rows);
        console.log(`📄 Feuille "${sheet.sheetName}":`);
        console.log(`   Colonnes détectées:`);
        console.log(`   - ID: ${detection.detected.id || "❌ Non trouvé"}`);
        console.log(`   - modelRef: ${detection.detected.modelRef || "❌ Non trouvé"}`);
        console.log(`   - color: ${detection.detected.color || "❌ Non trouvé"}`);
        console.log(`   - stockQuantity: ${detection.detected.stockQuantity || "❌ Non trouvé"}`);
        console.log(`   - priceWholesale: ${detection.detected.priceWholesale || "❌ Non trouvé"}`);
        console.log(`   - priceRetail: ${detection.detected.priceRetail || "❌ Non trouvé"}`);
        console.log();
      }
    });

    // Vérifier les valeurs suspectes
    console.log("=".repeat(60));
    console.log("🔍 VÉRIFICATION DES VALEURS:");
    console.log("=".repeat(60));
    console.log();

    result.sheets.forEach((sheet) => {
      if (sheet.rows.length > 0) {
        const detection = detectColumns(sheet.rows);
        const stockCol = detection.detected.stockQuantity;
        const priceCol = detection.detected.priceWholesale;

        if (stockCol || priceCol) {
          const suspicious = [];
          
          sheet.rows.forEach((row, idx) => {
            if (stockCol) {
              const stock = row[stockCol];
              const stockNum = Number(stock);
              if (stock && (isNaN(stockNum) || stockNum < 0 || stockNum > 10000)) {
                suspicious.push({
                  row: idx + 2,
                  column: stockCol,
                  value: stock,
                  issue: isNaN(stockNum) ? "N'est pas un nombre" : stockNum < 0 ? "Négatif" : "Trop élevé (>10000)",
                });
              }
            }

            if (priceCol) {
              const price = row[priceCol];
              const priceNum = Number(price);
              if (price && (isNaN(priceNum) || priceNum < 0 || priceNum > 100000)) {
                suspicious.push({
                  row: idx + 2,
                  column: priceCol,
                  value: price,
                  issue: isNaN(priceNum) ? "N'est pas un nombre" : priceNum < 0 ? "Négatif" : "Trop élevé (>100000)",
                });
              }
            }
          });

          if (suspicious.length > 0) {
            console.log(`⚠️  Feuille "${sheet.sheetName}" - ${suspicious.length} valeurs suspectes:`);
            suspicious.slice(0, 10).forEach(s => {
              console.log(`   Ligne ${s.row}, colonne "${s.column}": ${s.value} (${s.issue})`);
            });
            if (suspicious.length > 10) {
              console.log(`   ... et ${suspicious.length - 10} autres`);
            }
            console.log();
          } else {
            console.log(`✅ Feuille "${sheet.sheetName}": Aucune valeur suspecte détectée`);
            console.log();
          }
        }
      }
    });
  }
}

main().catch(console.error);

