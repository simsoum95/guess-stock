import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Change {
  modelRef: string;
  color: string;
  field: string;
  oldValue: any;
  newValue: any;
}

// Parser Excel - LIT TOUTES LES FEUILLES
function parseExcel(buffer: ArrayBuffer): { rows: any[]; sheetNames: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const allRows: any[] = [];
  const sheetNames: string[] = [];
  
  // Parcourir TOUTES les feuilles
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`[Excel] Feuille "${sheetName}": ${rows.length} lignes`);
    sheetNames.push(`${sheetName} (${rows.length})`);
    allRows.push(...rows);
  }
  
  console.log(`[Excel] Total: ${allRows.length} lignes de ${workbook.SheetNames.length} feuilles`);
  return { rows: allRows, sheetNames };
}

// Parser CSV
function parseCSV(text: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: (e: Error) => reject(e),
    });
  });
}

// Normaliser pour comparaison
function norm(s: any): string {
  if (!s) return "";
  return String(s).trim().toLowerCase();
}

// Noms hébreux des champs
const hebrewNames: Record<string, string> = {
  stockQuantity: "מלאי",
  priceRetail: "מחיר קמעונאי",
  priceWholesale: "מחיר סיטונאי",
  productName: "שם מוצר",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const syncStock = formData.get("syncStock") === "true"; // Option pour synchroniser le stock

    if (!file) {
      return NextResponse.json({ success: false, error: "לא נבחר קובץ" }, { status: 400 });
    }

    console.log("[Upload] Mode synchronisation stock:", syncStock);

    // Parser le fichier
    const fileName = file.name.toLowerCase();
    let rows: any[];
    let sheetInfo: string[] = [];
    
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const result = parseExcel(await file.arrayBuffer());
      rows = result.rows;
      sheetInfo = result.sheetNames;
    } else if (fileName.endsWith(".csv")) {
      rows = await parseCSV(await file.text());
      sheetInfo = ["CSV"];
    } else {
      return NextResponse.json({ success: false, error: "פורמט לא נתמך" }, { status: 400 });
    }

    if (!rows?.length) {
      return NextResponse.json({ success: false, error: "קובץ ריק" }, { status: 400 });
    }

    // Log colonnes détectées
    const columns = Object.keys(rows[0]);
    console.log("[Upload] Colonnes:", columns);
    console.log("[Upload] Total lignes:", rows.length);
    console.log("[Upload] Feuilles:", sheetInfo);
    
    // Afficher un exemple de ligne pour debug
    if (rows.length > 0) {
      console.log("[Upload] Exemple de ligne (première):", JSON.stringify(rows[0], null, 2));
    }

    // Charger TOUS les produits de Supabase
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Index MULTI-NIVEAU: ID en priorité, puis modelRef + color
    // Permet de différencier les produits avec même modelRef+color mais IDs différents
    const productById = new Map<string, any>(); // ID unique (le plus précis)
    const productByRefColor = new Map<string, any[]>(); // modelRef + color (peut avoir plusieurs produits)
    
    for (const p of products || []) {
      // Index par ID (le plus précis)
      if (p.id && p.id !== "GUESS") {
        productById.set(norm(p.id), p);
      }
      
      // Index par modelRef + color (peut avoir plusieurs produits)
      const refColorKey = `${norm(p.modelRef)}|${norm(p.color)}`;
      if (!productByRefColor.has(refColorKey)) {
        productByRefColor.set(refColorKey, []);
      }
      productByRefColor.get(refColorKey)!.push(p);
    }

    console.log(`[Upload] ${products?.length} produits en base`);
    console.log(`[Upload] ${productById.size} produits avec ID unique, ${productByRefColor.size} combinaisons modelRef+color`);

    // Résultats
    let updated = 0;
    let inserted = 0;
    let unchanged = 0;
    let stockZeroed = 0;
    const notFound: Array<{ modelRef: string; color: string }> = [];
    const insertedProducts: Array<{ modelRef: string; color: string }> = [];
    const zeroedProducts: Array<{ modelRef: string; color: string; oldStock: number }> = [];
    const changes: Change[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    
    // Tracker les produits vus dans le fichier (pour syncStock)
    const seenProductIds = new Set<string>();

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extraire id, modelRef et color (essayer plusieurs variantes de noms de colonnes)
      const id = row.id || row.ID || row.Id || row.ID || row["מזהה"] || row["מק\"ט מלא"] || row["מק״ט מלא"];
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF || row["מק״ט"] || row["מק\"ט"] || row["model"] || row["Model"];
      const color = row.color || row.Color || row.COLOR || row["צבע"] || row["colour"];

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit: PRIORITÉ à l'ID si fourni, sinon modelRef + color
      let existing = null;
      let matchedBy = "";
      
      // 1. Si un ID est fourni, essayer de matcher par ID d'abord (le plus précis)
      if (id) {
        existing = productById.get(norm(id));
        if (existing) {
          matchedBy = "id";
          console.log(`[Row ${rowNum}] Matched by ID: "${id}" → ${existing.modelRef} / ${existing.color}`);
        }
      }
      
      // 2. Si pas de match par ID, chercher par modelRef + color
      if (!existing) {
        const key = `${norm(modelRef)}|${norm(color)}`;
        const candidates = productByRefColor.get(key) || [];
        
        if (candidates.length === 1) {
          // Un seul produit avec ce modelRef+color
          existing = candidates[0];
          matchedBy = "modelRef+color (unique)";
          console.log(`[Row ${rowNum}] Matched by modelRef+color (unique): "${modelRef}" / "${color}"`);
        } else if (candidates.length > 1) {
          // Plusieurs produits avec le même modelRef+color
          // Si un ID était fourni mais pas trouvé, c'est une erreur
          if (id) {
            errors.push({ 
              row: rowNum, 
              message: `Plusieurs produits avec modelRef="${modelRef}" et color="${color}". ID "${id}" non trouvé. Utilisez l'ID exact.` 
            });
            continue;
          }
          // Sinon, prendre le premier (ou on pourrait prendre celui avec le stock le plus élevé)
          existing = candidates[0];
          matchedBy = `modelRef+color (${candidates.length} produits, pris le premier)`;
          console.log(`[Row ${rowNum}] ⚠️  Plusieurs produits avec "${modelRef}" / "${color}". Pris le premier (ID: ${existing.id})`);
        }
      }
      
      console.log(`[Row ${rowNum}] id="${id || 'N/A'}", modelRef="${modelRef}", color="${color}" → ${matchedBy || "NOT FOUND"}`);

      // Tracker le produit vu pour syncStock
      if (existing) {
        seenProductIds.add(existing.id);
      }

      if (!existing) {
        // NOUVEAU PRODUIT → L'INSÉRER
        // Utiliser l'ID fourni dans le fichier, ou générer un ID unique
        const uniqueId = id || `${modelRef}-${color}-${Date.now()}`;
        
        console.log(`[Row ${rowNum}] NOUVEAU PRODUIT - ID: "${uniqueId}", modelRef: "${modelRef}", color: "${color}"`);
        
        const newProduct: Record<string, any> = {
          id: uniqueId,
          modelRef: modelRef,
          color: color,
          brand: row.brand || row.Brand || "GUESS",
          subcategory: row.subcategory || row.category || row.Category || "תיק",
          category: row.subcategory || row.category || row.Category || "תיק",
          collection: row.collection || row.Collection || "",
          supplier: row.supplier || row.Supplier || "",
          gender: row.gender || row.Gender || "Women",
          priceRetail: (() => {
            const val = row.priceRetail || 0;
            const cleaned = String(val).trim().replace(/,/g, ".").replace(/\s/g, "");
            const parsed = parseFloat(cleaned);
            return (isNaN(parsed) || !isFinite(parsed) || parsed < 0) ? 0 : Math.min(parsed, 100000);
          })(),
          priceWholesale: (() => {
            const val = row.priceWholesale || 0;
            const cleaned = String(val).trim().replace(/,/g, ".").replace(/\s/g, "");
            const parsed = parseFloat(cleaned);
            return (isNaN(parsed) || !isFinite(parsed) || parsed < 0) ? 0 : Math.min(parsed, 100000);
          })(),
          stockQuantity: (() => {
            const val = row.stockQuantity || row.stock || 0;
            const cleaned = String(val).trim().replace(/,/g, "").replace(/\s/g, "");
            const parsed = parseInt(cleaned, 10);
            return (isNaN(parsed) || !isFinite(parsed) || parsed < 0) ? 0 : Math.min(parsed, 10000);
          })(),
          imageUrl: row.imageUrl || "/images/default.png",
          gallery: [],
          productName: row.productName || modelRef,
        };

        console.log(`[Row ${rowNum}] INSERTING NEW PRODUCT:`, newProduct);

        const { error: insertErr } = await supabase.from("products").insert(newProduct);

        if (insertErr) {
          console.error(`[Row ${rowNum}] Insert error:`, insertErr);
          errors.push({ row: rowNum, message: `שגיאה בהוספה: ${insertErr.message}` });
          notFound.push({ modelRef, color });
        } else {
          inserted++;
          insertedProducts.push({ modelRef, color });
        }
        continue;
      }

      // Comparer et préparer les mises à jour
      const updates: Record<string, any> = {};
      const rowChanges: Change[] = [];

      // stockQuantity - Parsing strict avec validation
      const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.STOCKQUANTITY ?? row.stock ?? row.Stock;
      if (stockRaw !== undefined && stockRaw !== null && stockRaw !== "") {
        // Nettoyer la valeur : enlever les espaces, virgules, etc.
        const cleaned = String(stockRaw).trim().replace(/,/g, "").replace(/\s/g, "");
        const newVal = parseInt(cleaned, 10);
        
        // Validation : stock doit être un nombre valide entre 0 et 10000 (limite raisonnable)
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Stock invalide: "${stockRaw}" (doit être un nombre)` });
          continue;
        }
        
        if (newVal < 0) {
          errors.push({ row: rowNum, message: `Stock négatif: ${newVal} (mis à 0)` });
          updates.stockQuantity = 0;
        } else if (newVal > 10000) {
          errors.push({ row: rowNum, message: `Stock suspect (>10000): ${newVal}. Vérifiez la valeur.` });
          // On met quand même à jour mais avec un avertissement
          updates.stockQuantity = newVal;
        } else {
          const oldVal = parseInt(String(existing.stockQuantity || 0), 10) || 0;
          if (newVal !== oldVal) {
            updates.stockQuantity = newVal;
            rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
          }
        }
        console.log(`[Row ${rowNum}] Stock: file="${stockRaw}" → cleaned="${cleaned}" → parsed=${newVal}, db=${existing.stockQuantity}`);
      }

      // priceRetail - Parsing strict avec validation
      if (row.priceRetail !== undefined && row.priceRetail !== null && row.priceRetail !== "") {
        const cleaned = String(row.priceRetail).trim().replace(/,/g, ".").replace(/\s/g, "");
        const newVal = parseFloat(cleaned);
        
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Prix retail invalide: "${row.priceRetail}"` });
        } else if (newVal < 0) {
          errors.push({ row: rowNum, message: `Prix retail négatif: ${newVal}` });
        } else if (newVal > 100000) {
          errors.push({ row: rowNum, message: `Prix retail suspect (>100000): ${newVal}. Vérifiez la valeur.` });
        } else {
          const oldVal = existing.priceRetail || 0;
          if (Math.abs(newVal - oldVal) > 0.01) {
            updates.priceRetail = newVal;
            rowChanges.push({ modelRef, color, field: "מחיר קמעונאי", oldValue: oldVal, newValue: newVal });
          }
        }
      }

      // priceWholesale - Parsing strict avec validation
      if (row.priceWholesale !== undefined && row.priceWholesale !== null && row.priceWholesale !== "") {
        const cleaned = String(row.priceWholesale).trim().replace(/,/g, ".").replace(/\s/g, "");
        const newVal = parseFloat(cleaned);
        
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Prix wholesale invalide: "${row.priceWholesale}"` });
        } else if (newVal < 0) {
          errors.push({ row: rowNum, message: `Prix wholesale négatif: ${newVal}` });
        } else if (newVal > 100000) {
          errors.push({ row: rowNum, message: `Prix wholesale suspect (>100000): ${newVal}. Vérifiez la valeur.` });
        } else {
          const oldVal = existing.priceWholesale || 0;
          if (Math.abs(newVal - oldVal) > 0.01) {
            updates.priceWholesale = newVal;
            rowChanges.push({ modelRef, color, field: "מחיר סיטונאי", oldValue: oldVal, newValue: newVal });
          }
        }
      }

      // productName
      if (row.productName !== undefined && row.productName !== null && row.productName !== "") {
        const newVal = String(row.productName).trim();
        const oldVal = existing.productName || "";
        if (newVal !== oldVal) {
          updates.productName = newVal;
          rowChanges.push({ modelRef, color, field: "שם מוצר", oldValue: oldVal, newValue: newVal });
        }
      }

      // Si des changements existent, faire l'UPDATE
      if (Object.keys(updates).length > 0) {
        console.log(`[Upload] Updating id="${existing.id}" (${modelRef} / ${color}):`, updates);
        
        // Utiliser l'ID pour l'update (plus précis et plus rapide)
        const { error: updateErr } = await supabase
          .from("products")
          .update(updates)
          .eq("id", existing.id);

        if (updateErr) {
          errors.push({ row: rowNum, message: updateErr.message });
        } else {
          updated++;
          changes.push(...rowChanges);
        }
      } else {
        unchanged++;
      }
    }

    // SYNCHRONISATION STOCK: Mettre à 0 les produits qui ne sont pas dans le fichier
    if (syncStock) {
      console.log(`[SyncStock] ${seenProductIds.size} produits vus dans le fichier, ${products?.length || 0} en base`);
      
      for (const product of products || []) {
        // Si le produit n'a pas été vu dans le fichier ET a du stock > 0
        if (!seenProductIds.has(product.id) && product.stockQuantity > 0) {
          console.log(`[SyncStock] Mise à 0 stock: ${product.modelRef} / ${product.color} (était: ${product.stockQuantity})`);
          
          const { error: zeroErr } = await supabase
            .from("products")
            .update({ stockQuantity: 0 })
            .eq("id", product.id);

          if (zeroErr) {
            errors.push({ row: -1, message: `Erreur sync ${product.modelRef}: ${zeroErr.message}` });
          } else {
            stockZeroed++;
            zeroedProducts.push({ 
              modelRef: product.modelRef, 
              color: product.color, 
              oldStock: product.stockQuantity 
            });
            changes.push({
              modelRef: product.modelRef,
              color: product.color,
              field: "מלאי (סנכרון)",
              oldValue: product.stockQuantity,
              newValue: 0,
            });
          }
        }
      }
      
      console.log(`[SyncStock] ${stockZeroed} produits mis à stock 0`);
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      updated,
      inserted,
      unchanged,
      stockZeroed,
      notFound,
      insertedProducts,
      zeroedProducts,
      changes,
      errors,
      detectedColumns: columns,
      sheets: sheetInfo,
      syncStockEnabled: syncStock,
    });

  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
