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

export async function POST(request: NextRequest) {
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

    // Charger tous les produits
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Index par modelRef + color
    const productMap = new Map<string, any>();
    for (const p of products || []) {
      const key = `${norm(p.modelRef)}|${norm(p.color)}`;
      productMap.set(key, p);
    }

    // Résultats
    let updated = 0;
    let unchanged = 0;
    let stockZeroed = 0;
    const notFound: Array<{ modelRef: string; color: string }> = [];
    const changes: Change[] = [];
    const zeroedProducts: Array<{ modelRef: string; color: string; oldStock: number }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    const seenKeys = new Set<string>();

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const modelRef = row.modelRef || row.ModelRef || row.MODELREF;
      const color = row.color || row.Color || row.COLOR;

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      const key = `${norm(modelRef)}|${norm(color)}`;
      seenKeys.add(key);
      
      const existing = productMap.get(key);

      if (!existing) {
        notFound.push({ modelRef, color });
        continue;
      }

      // Comparer et préparer les mises à jour
      const updates: Record<string, any> = {};
      const rowChanges: Change[] = [];

      // Stock - accepter noms tronqués
      const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.stockQuanti ?? row.stock ?? row.Stock;
      if (stockRaw !== undefined && stockRaw !== null && stockRaw !== "") {
        const newVal = parseInt(String(stockRaw)) || 0;
        const oldVal = parseInt(String(existing.stockQuantity)) || 0;
        if (newVal !== oldVal) {
          updates.stockQuantity = newVal;
          rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
        }
      }

      // PRIX DÉSACTIVÉS - seulement stock est mis à jour

      // Appliquer les mises à jour
      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from("products")
          .update(updates)
          .eq("modelRef", existing.modelRef)
          .eq("color", existing.color);

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

    // Sync stock - mettre à 0 les produits absents
    if (syncStock) {
      for (const p of products || []) {
        const key = `${norm(p.modelRef)}|${norm(p.color)}`;
        if (!seenKeys.has(key) && p.stockQuantity > 0) {
          await supabase
            .from("products")
            .update({ stockQuantity: 0 })
            .eq("modelRef", p.modelRef)
            .eq("color", p.color);
          
          stockZeroed++;
          zeroedProducts.push({ modelRef: p.modelRef, color: p.color, oldStock: p.stockQuantity });
          changes.push({ modelRef: p.modelRef, color: p.color, field: "מלאי (סנכרון)", oldValue: p.stockQuantity, newValue: 0 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      updated,
      unchanged,
      stockZeroed,
      notFound,
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
