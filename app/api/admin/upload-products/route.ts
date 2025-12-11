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

// Parser Excel
function parseExcel(buffer: ArrayBuffer): any[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
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

    if (!file) {
      return NextResponse.json({ success: false, error: "לא נבחר קובץ" }, { status: 400 });
    }

    // Parser le fichier
    const fileName = file.name.toLowerCase();
    let rows: any[];
    
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      rows = parseExcel(await file.arrayBuffer());
    } else if (fileName.endsWith(".csv")) {
      rows = await parseCSV(await file.text());
    } else {
      return NextResponse.json({ success: false, error: "פורמט לא נתמך" }, { status: 400 });
    }

    if (!rows?.length) {
      return NextResponse.json({ success: false, error: "קובץ ריק" }, { status: 400 });
    }

    // Log colonnes détectées
    const columns = Object.keys(rows[0]);
    console.log("[Upload] Colonnes:", columns);
    console.log("[Upload] Ligne 1:", JSON.stringify(rows[0]));
    if (rows.length > 20) console.log("[Upload] Ligne 21:", JSON.stringify(rows[20]));
    if (rows.length > 31) console.log("[Upload] Ligne 32:", JSON.stringify(rows[31]));

    // Charger TOUS les produits de Supabase
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Index par modelRef + color (normalisé)
    const productMap = new Map<string, any>();
    for (const p of products || []) {
      const key = `${norm(p.modelRef)}|${norm(p.color)}`;
      productMap.set(key, p);
    }

    console.log(`[Upload] ${productMap.size} produits en base`);

    // Résultats
    let updated = 0;
    let unchanged = 0;
    const notFound: Array<{ modelRef: string; color: string }> = [];
    const changes: Change[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extraire modelRef et color
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF;
      const color = row.color || row.Color || row.COLOR;

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef ou color manquant" });
        continue;
      }

      // Chercher le produit
      const key = `${norm(modelRef)}|${norm(color)}`;
      const existing = productMap.get(key);

      if (!existing) {
        notFound.push({ modelRef, color });
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
        console.log(`[Row ${rowNum}] Stock: file=${stockRaw} (parsed=${newVal}), db=${existing.stockQuantity} (parsed=${oldVal}), different=${newVal !== oldVal}`);
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

      // Si des changements existent, faire l'UPDATE
      if (Object.keys(updates).length > 0) {
        console.log(`[Upload] Updating ${modelRef} / ${color}:`, updates);
        
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

    // Échantillon de lignes pour débogage
    const sampleRows = rows.slice(0, 3).map((r, i) => ({
      row: i + 2,
      modelRef: r.modelRef,
      color: r.color,
      stockQuantity: r.stockQuantity,
    }));

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      updated,
      unchanged,
      notFound,
      changes,
      errors,
      detectedColumns: columns,
      sampleRows,
      debug: {
        row21: rows[19] ? { modelRef: rows[19].modelRef, color: rows[19].color, stock: rows[19].stockQuantity } : null,
        row32: rows[30] ? { modelRef: rows[30].modelRef, color: rows[30].color, stock: rows[30].stockQuantity } : null,
      }
    });

  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
