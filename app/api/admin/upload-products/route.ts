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
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    sheetNames.push(`${sheetName} (${rows.length})`);
    allRows.push(...rows);
  }
  
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

// Extraire valeur avec noms anglais + hébreu
function getVal(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      return row[k];
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const syncStock = formData.get("syncStock") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "לא נבחר קובץ" }, { status: 400 });
    }

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

    const columns = Object.keys(rows[0]);
    console.log(`[Upload] ${rows.length} lignes, colonnes: ${columns.join(", ")}`);

    // Charger TOUS les produits de Supabase (1 seule requête)
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Créer les index pour recherche rapide
    const productById = new Map<string, any>();
    const productByRefColor = new Map<string, any>();
    
    for (const p of products || []) {
      if (p.id) productById.set(norm(p.id), p);
      const key = `${norm(p.modelRef)}|${norm(p.color)}`;
      productByRefColor.set(key, p);
    }

    // Collections pour batch operations
    const toInsert: any[] = [];
    const toUpdate: { id: string; updates: Record<string, any> }[] = [];
    const seenProductIds = new Set<string>();
    
    // Résultats
    const changes: Change[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const insertedProducts: Array<{ modelRef: string; color: string }> = [];
    let unchanged = 0;

    // Traiter chaque ligne (juste préparer les données, pas de requête)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extraire les champs (anglais + hébreu)
      const id = getVal(row, "id", "ID", "Id", "מזהה");
      const modelRef = getVal(row, "modelRef", "ModelRef", "MODELREF", "קוד גם", "קוד", 'מק"ט', "מקט");
      const color = getVal(row, "color", "Color", "COLOR", "צבע");

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit existant
      let existing = null;
      if (id) existing = productById.get(norm(id));
      if (!existing) existing = productByRefColor.get(`${norm(modelRef)}|${norm(color)}`);

      if (existing) seenProductIds.add(existing.id);

      // Extraire les valeurs
      const stockRaw = getVal(row, "stockQuantity", "stock", "Stock", "כמות מלאי נוכחי", "מלאי", "כמות");
      const priceRetailRaw = getVal(row, "priceRetail", 'מחיר כולל מע"מ בסיס', 'מחיר כולל מע"מ', "מחיר קמעונאי", "מחיר");
      const priceWholesaleRaw = getVal(row, "priceWholesale", "סיטונאי", "מחיר סיטונאי");
      const productNameRaw = getVal(row, "productName", "שם מוצר");

      if (!existing) {
        // NOUVEAU PRODUIT - ajouter à la liste d'insertion
        const brand = getVal(row, "brand", "Brand", "מותג") || "GUESS";
        const subcategory = getVal(row, "subcategory", "category", "Category", "תת משפחה", "קטגוריה") || "תיק";
        const collection = getVal(row, "collection", "Collection", "קולקציה") || "";
        const supplier = getVal(row, "supplier", "Supplier", "ספק") || "";
        const gender = getVal(row, "gender", "Gender", "מגדר") || "Women";
        
        toInsert.push({
          id: id || `${modelRef}-${color}-${Date.now()}-${i}`,
          modelRef,
          color,
          brand,
          subcategory,
          category: subcategory,
          collection,
          supplier,
          gender,
          priceRetail: parseFloat(String(priceRetailRaw || 0).replace(",", ".")) || 0,
          priceWholesale: parseFloat(String(priceWholesaleRaw || 0).replace(",", ".")) || 0,
          stockQuantity: parseInt(String(stockRaw || 0)) || 0,
          imageUrl: row.imageUrl || "/images/default.png",
          gallery: [],
          productName: productNameRaw || modelRef,
        });
        insertedProducts.push({ modelRef, color });
      } else {
        // PRODUIT EXISTANT - préparer les updates
        const updates: Record<string, any> = {};
        const rowChanges: Change[] = [];

        // Stock
        if (stockRaw !== undefined) {
          const newVal = parseInt(String(stockRaw)) || 0;
          const oldVal = parseInt(String(existing.stockQuantity)) || 0;
          if (newVal !== oldVal) {
            updates.stockQuantity = newVal;
            rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
          }
        }

        // Prix retail
        if (priceRetailRaw !== undefined) {
          const newVal = parseFloat(String(priceRetailRaw).replace(",", ".")) || 0;
          const oldVal = existing.priceRetail || 0;
          if (Math.abs(newVal - oldVal) > 0.01) {
            updates.priceRetail = newVal;
            rowChanges.push({ modelRef, color, field: "מחיר קמעונאי", oldValue: oldVal, newValue: newVal });
          }
        }

        // Prix wholesale
        if (priceWholesaleRaw !== undefined) {
          const newVal = parseFloat(String(priceWholesaleRaw).replace(",", ".")) || 0;
          const oldVal = existing.priceWholesale || 0;
          if (Math.abs(newVal - oldVal) > 0.01) {
            updates.priceWholesale = newVal;
            rowChanges.push({ modelRef, color, field: "מחיר סיטונאי", oldValue: oldVal, newValue: newVal });
          }
        }

        // Nom produit
        if (productNameRaw !== undefined) {
          const newVal = String(productNameRaw).trim();
          const oldVal = existing.productName || "";
          if (newVal !== oldVal) {
            updates.productName = newVal;
            rowChanges.push({ modelRef, color, field: "שם מוצר", oldValue: oldVal, newValue: newVal });
          }
        }

        if (Object.keys(updates).length > 0) {
          toUpdate.push({ id: existing.id, updates });
          changes.push(...rowChanges);
        } else {
          unchanged++;
        }
      }
    }

    // ====== BATCH OPERATIONS ======
    let inserted = 0;
    let updated = 0;
    let stockZeroed = 0;
    const zeroedProducts: Array<{ modelRef: string; color: string; oldStock: number }> = [];

    // BATCH INSERT (par lots de 100)
    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await supabase.from("products").insert(batch);
        if (insertErr) {
          console.error("[Batch Insert Error]", insertErr);
          errors.push({ row: -1, message: `Erreur insertion batch: ${insertErr.message}` });
        } else {
          inserted += batch.length;
        }
      }
    }

    // BATCH UPDATE (utiliser upsert ou updates individuels groupés)
    if (toUpdate.length > 0) {
      // Grouper les updates par champs identiques pour optimiser
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        
        // Exécuter les updates en parallèle
        const updatePromises = batch.map(({ id, updates }) =>
          supabase.from("products").update(updates).eq("id", id)
        );
        
        const results = await Promise.all(updatePromises);
        
        for (const { error } of results) {
          if (error) {
            errors.push({ row: -1, message: error.message });
          } else {
            updated++;
          }
        }
      }
    }

    // SYNC STOCK - Batch update pour mettre à 0
    if (syncStock) {
      const toZero: string[] = [];
      
      for (const product of products || []) {
        if (!seenProductIds.has(product.id) && product.stockQuantity > 0) {
          toZero.push(product.id);
          zeroedProducts.push({
            modelRef: product.modelRef,
            color: product.color,
            oldStock: product.stockQuantity,
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

      // Batch zero update
      if (toZero.length > 0) {
        const { error: zeroErr } = await supabase
          .from("products")
          .update({ stockQuantity: 0 })
          .in("id", toZero);

        if (zeroErr) {
          errors.push({ row: -1, message: `Erreur sync: ${zeroErr.message}` });
        } else {
          stockZeroed = toZero.length;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Upload] Terminé en ${duration}s: ${inserted} insérés, ${updated} modifiés, ${unchanged} inchangés`);

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      updated,
      inserted,
      unchanged,
      stockZeroed,
      insertedProducts,
      zeroedProducts,
      changes,
      errors,
      detectedColumns: columns,
      sheets: sheetInfo,
      syncStockEnabled: syncStock,
      duration: `${duration}s`,
    });

  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
