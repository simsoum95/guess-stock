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

    // Charger TOUS les produits de Supabase
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Index par TOUTES les clés possibles (du plus précis au moins précis)
    const productByFullKey = new Map<string, any>(); // id + modelRef + color
    const productById = new Map<string, any>();       // id seul
    const productByRefColor = new Map<string, any>(); // modelRef + color
    
    for (const p of products || []) {
      // Clé complète : id + modelRef + color (la plus précise)
      const fullKey = `${norm(p.id)}|${norm(p.modelRef)}|${norm(p.color)}`;
      productByFullKey.set(fullKey, p);
      
      // Index par ID seul
      if (p.id) {
        productById.set(norm(p.id), p);
      }
      
      // Index par modelRef + color
      const refColorKey = `${norm(p.modelRef)}|${norm(p.color)}`;
      productByRefColor.set(refColorKey, p);
    }

    console.log(`[Upload] ${products?.length} produits en base`);

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

      // Extraire id, modelRef et color (anglais + hébreu)
      const id = row.id || row.ID || row.Id || row["מזהה"];
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF || row["קוד גם"] || row["קוד"] || row["מק\"ט"] || row["מקט"];
      const color = row.color || row.Color || row.COLOR || row["צבע"];

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit - Du PLUS PRÉCIS au moins précis
      let existing = null;
      let matchedBy = "";
      
      // 1. D'abord essayer avec la clé complète (id + modelRef + color)
      if (id) {
        const fullKey = `${norm(id)}|${norm(modelRef)}|${norm(color)}`;
        existing = productByFullKey.get(fullKey);
        if (existing) matchedBy = "id+modelRef+color";
      }
      
      // 2. Sinon essayer avec l'ID seul
      if (!existing && id) {
        existing = productById.get(norm(id));
        if (existing) matchedBy = "id";
      }
      
      // 3. Enfin essayer avec modelRef + color
      if (!existing) {
        const key = `${norm(modelRef)}|${norm(color)}`;
        existing = productByRefColor.get(key);
        if (existing) matchedBy = "modelRef+color";
      }
      
      console.log(`[Row ${rowNum}] id="${id}", modelRef="${modelRef}", color="${color}" → ${matchedBy || "NOT FOUND"}`);

      // Tracker le produit vu pour syncStock
      if (existing) {
        seenProductIds.add(existing.id);
      }

      if (!existing) {
        // NOUVEAU PRODUIT → L'INSÉRER
        // Extraire les valeurs (anglais + hébreu)
        const brand = row.brand || row.Brand || row["מותג"] || "GUESS";
        const subcategory = row.subcategory || row.category || row.Category || row["תת משפחה"] || row["קטגוריה"] || "תיק";
        const collection = row.collection || row.Collection || row["קולקציה"] || "";
        const supplier = row.supplier || row.Supplier || row["ספק"] || "";
        const gender = row.gender || row.Gender || row["מגדר"] || "Women";
        const priceRetailRaw = row.priceRetail || row["מחיר כולל מע\"מ בסיס"] || row["מחיר כולל מע\"מ"] || row["מחיר קמעונאי"] || row["מחיר"] || 0;
        const priceWholesaleRaw = row.priceWholesale || row["סיטונאי"] || row["מחיר סיטונאי"] || 0;
        const stockRaw = row.stockQuantity || row.stock || row["כמות מלאי נוכחי"] || row["מלאי"] || row["כמות"] || 0;
        
        const newProduct: Record<string, any> = {
          id: id || `${modelRef}-${color}-${Date.now()}`, // Générer un ID unique
          modelRef: modelRef,
          color: color,
          brand: brand,
          subcategory: subcategory,
          category: subcategory,
          collection: collection,
          supplier: supplier,
          gender: gender,
          priceRetail: parseFloat(String(priceRetailRaw).replace(",", ".")) || 0,
          priceWholesale: parseFloat(String(priceWholesaleRaw).replace(",", ".")) || 0,
          stockQuantity: parseInt(String(stockRaw)) || 0,
          imageUrl: row.imageUrl || "/images/default.png",
          gallery: [],
          productName: row.productName || row["שם מוצר"] || modelRef,
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

      // stockQuantity (anglais + hébreu)
      const stockRawUpdate = row.stockQuantity ?? row.StockQuantity ?? row.STOCKQUANTITY ?? row.stock ?? row.Stock ?? row["כמות מלאי נוכחי"] ?? row["מלאי"] ?? row["כמות"];
      if (stockRawUpdate !== undefined && stockRawUpdate !== null && stockRawUpdate !== "") {
        const newVal = parseInt(String(stockRawUpdate)) || 0;
        const oldVal = parseInt(String(existing.stockQuantity)) || 0;
        console.log(`[Row ${rowNum}] Stock: file=${stockRawUpdate} (parsed=${newVal}), db=${existing.stockQuantity} (parsed=${oldVal}), different=${newVal !== oldVal}`);
        if (newVal !== oldVal) {
          updates.stockQuantity = newVal;
          rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // priceRetail (anglais + hébreu)
      const priceRetailVal = row.priceRetail ?? row["מחיר כולל מע\"מ בסיס"] ?? row["מחיר כולל מע\"מ"] ?? row["מחיר קמעונאי"] ?? row["מחיר"];
      if (priceRetailVal !== undefined && priceRetailVal !== null && priceRetailVal !== "") {
        const newVal = parseFloat(String(priceRetailVal).replace(",", ".")) || 0;
        const oldVal = existing.priceRetail || 0;
        if (Math.abs(newVal - oldVal) > 0.01) {
          updates.priceRetail = newVal;
          rowChanges.push({ modelRef, color, field: "מחיר קמעונאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // priceWholesale (anglais + hébreu)
      const priceWholesaleVal = row.priceWholesale ?? row["סיטונאי"] ?? row["מחיר סיטונאי"];
      if (priceWholesaleVal !== undefined && priceWholesaleVal !== null && priceWholesaleVal !== "") {
        const newVal = parseFloat(String(priceWholesaleVal).replace(",", ".")) || 0;
        const oldVal = existing.priceWholesale || 0;
        if (Math.abs(newVal - oldVal) > 0.01) {
          updates.priceWholesale = newVal;
          rowChanges.push({ modelRef, color, field: "מחיר סיטונאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // productName (anglais + hébreu)
      const productNameVal = row.productName ?? row["שם מוצר"];
      if (productNameVal !== undefined && productNameVal !== null && productNameVal !== "") {
        const newVal = String(productNameVal).trim();
        const oldVal = existing.productName || "";
        if (newVal !== oldVal) {
          updates.productName = newVal;
          rowChanges.push({ modelRef, color, field: "שם מוצר", oldValue: oldVal, newValue: newVal });
        }
      }

      // Si des changements existent, faire l'UPDATE
      if (Object.keys(updates).length > 0) {
        console.log(`[Upload] Updating id="${existing.id}" (${modelRef} / ${color}):`, updates);
        
        // Utiliser l'ID pour l'update si disponible (plus précis)
        let updateQuery = supabase.from("products").update(updates);
        
        if (existing.id && existing.id !== "GUESS") {
          updateQuery = updateQuery.eq("id", existing.id);
        } else {
          updateQuery = updateQuery.eq("modelRef", existing.modelRef).eq("color", existing.color);
        }
        
        const { error: updateErr } = await updateQuery;

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
