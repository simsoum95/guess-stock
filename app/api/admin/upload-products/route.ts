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

interface ProductSnapshot {
  id: string;
  modelRef: string;
  color: string;
  stockQuantity: number;
  priceRetail: number;
  priceWholesale: number;
  productName?: string;
}

// Parser Excel - LIT TOUTES LES FEUILLES
function parseExcel(buffer: ArrayBuffer): { rows: any[]; sheetNames: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const allRows: any[] = [];
  const sheetNames: string[] = [];
  
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
  return String(s).trim().toLowerCase().replace(/[-–—]/g, "-");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const syncStock = formData.get("syncStock") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "לא נבחר קובץ" }, { status: 400 });
    }

    console.log("[Upload] Mode synchronisation stock:", syncStock);
    console.log("[Upload] Fichier:", file.name);

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
    console.log("[Upload] Colonnes:", columns);
    console.log("[Upload] Total lignes:", rows.length);

    // Charger TOUS les produits de Supabase
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // SAUVEGARDER L'ÉTAT AVANT MODIFICATIONS (pour restauration)
    const snapshotBefore: ProductSnapshot[] = (products || []).map(p => ({
      id: p.id,
      modelRef: p.modelRef,
      color: p.color,
      stockQuantity: p.stockQuantity,
      priceRetail: p.priceRetail,
      priceWholesale: p.priceWholesale,
      productName: p.productName,
    }));

    // Index par TOUTES les clés possibles
    const productByFullKey = new Map<string, any>();
    const productById = new Map<string, any>();
    const productByRefColor = new Map<string, any>();
    
    for (const p of products || []) {
      const fullKey = `${norm(p.id)}|${norm(p.modelRef)}|${norm(p.color)}`;
      productByFullKey.set(fullKey, p);
      
      if (p.id) {
        productById.set(norm(p.id), p);
      }
      
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
    const seenProductIds = new Set<string>();

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const id = row.id || row.ID || row.Id;
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF;
      const color = row.color || row.Color || row.COLOR;

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit
      let existing = null;
      let matchedBy = "";
      
      if (id) {
        const fullKey = `${norm(id)}|${norm(modelRef)}|${norm(color)}`;
        existing = productByFullKey.get(fullKey);
        if (existing) matchedBy = "id+modelRef+color";
      }
      
      if (!existing && id) {
        existing = productById.get(norm(id));
        if (existing) matchedBy = "id";
      }
      
      if (!existing) {
        const key = `${norm(modelRef)}|${norm(color)}`;
        existing = productByRefColor.get(key);
        if (existing) matchedBy = "modelRef+color";
      }

      if (existing) {
        seenProductIds.add(existing.id);
      }

      if (!existing) {
        // NOUVEAU PRODUIT
        const newProduct: Record<string, any> = {
          id: id || `${modelRef}-${color}-${Date.now()}`,
          modelRef: modelRef,
          color: color,
          brand: row.brand || row.Brand || "GUESS",
          subcategory: row.subcategory || row.category || row.Category || "תיק",
          category: row.subcategory || row.category || row.Category || "תיק",
          collection: row.collection || row.Collection || "",
          supplier: row.supplier || row.Supplier || "",
          gender: row.gender || row.Gender || "Women",
          priceRetail: parseFloat(String(row.priceRetail || 0).replace(",", ".")) || 0,
          priceWholesale: parseFloat(String(row.priceWholesale || 0).replace(",", ".")) || 0,
          stockQuantity: parseInt(String(row.stockQuantity || row.stock || 0)) || 0,
          imageUrl: row.imageUrl || "/images/default.png",
          gallery: [],
          productName: row.productName || modelRef,
        };

        const { error: insertErr } = await supabase.from("products").insert(newProduct);

        if (insertErr) {
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

      // stockQuantity
      const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.STOCKQUANTITY ?? row.stock ?? row.Stock;
      if (stockRaw !== undefined && stockRaw !== null && stockRaw !== "") {
        const newVal = parseInt(String(stockRaw)) || 0;
        const oldVal = parseInt(String(existing.stockQuantity)) || 0;
        if (newVal !== oldVal) {
          updates.stockQuantity = newVal;
          rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // priceRetail
      if (row.priceRetail !== undefined && row.priceRetail !== null && row.priceRetail !== "") {
        const newVal = parseFloat(String(row.priceRetail).replace(",", ".")) || 0;
        const oldVal = existing.priceRetail || 0;
        if (Math.abs(newVal - oldVal) > 0.01) {
          updates.priceRetail = newVal;
          rowChanges.push({ modelRef, color, field: "מחיר קמעונאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // priceWholesale
      if (row.priceWholesale !== undefined && row.priceWholesale !== null && row.priceWholesale !== "") {
        const newVal = parseFloat(String(row.priceWholesale).replace(",", ".")) || 0;
        const oldVal = existing.priceWholesale || 0;
        if (Math.abs(newVal - oldVal) > 0.01) {
          updates.priceWholesale = newVal;
          rowChanges.push({ modelRef, color, field: "מחיר סיטונאי", oldValue: oldVal, newValue: newVal });
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

      if (Object.keys(updates).length > 0) {
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

    // SYNCHRONISATION STOCK
    if (syncStock) {
      for (const product of products || []) {
        if (!seenProductIds.has(product.id) && product.stockQuantity > 0) {
          const { error: zeroErr } = await supabase
            .from("products")
            .update({ stockQuantity: 0 })
            .eq("id", product.id);

          if (!zeroErr) {
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
    }

    // SAUVEGARDER DANS L'HISTORIQUE
    let historyId: string | null = null;
    let historyError: string | null = null;

    try {
      const historyEntry = {
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        stats: { updated, inserted, unchanged, stockZeroed, errors: errors.length },
        changes: changes.slice(0, 100),
        inserted_products: insertedProducts.slice(0, 50),
        zeroed_products: zeroedProducts.slice(0, 50),
        snapshot_before: snapshotBefore,
        sync_stock_enabled: syncStock,
      };

      console.log("[Upload] Saving to history...");
      const { data: insertedHistory, error: historyInsertErr } = await supabase
        .from("upload_history")
        .insert(historyEntry)
        .select("id")
        .single();

      if (historyInsertErr) {
        console.error("[Upload] History insert error:", historyInsertErr);
        historyError = historyInsertErr.message;
        
        // Log si la table n'existe pas
        if (historyInsertErr.message.includes("does not exist")) {
          console.log("[Upload] Table upload_history does not exist - please create it in Supabase");
        }
      } else {
        historyId = insertedHistory?.id || null;
        console.log("[Upload] History saved with ID:", historyId);

        // Garder seulement les 5 derniers
        const { data: allHistory } = await supabase
          .from("upload_history")
          .select("id")
          .order("uploaded_at", { ascending: false });
        
        if (allHistory && allHistory.length > 5) {
          const idsToDelete = allHistory.slice(5).map(h => h.id);
          await supabase.from("upload_history").delete().in("id", idsToDelete);
        }
      }
    } catch (err: any) {
      console.error("[Upload] History error:", err);
      historyError = err.message;
    }

    return NextResponse.json({
      success: true,
      historyId,
      historyError,
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
