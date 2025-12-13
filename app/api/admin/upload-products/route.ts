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

    // Index SIMPLIFIÉ: Utiliser uniquement modelRef + color comme clé unique
    // C'est plus fiable et évite les problèmes de matching multiple
    const productByRefColor = new Map<string, any>(); // modelRef + color
    
    for (const p of products || []) {
      // Index par modelRef + color (clé unique principale)
      const refColorKey = `${norm(p.modelRef)}|${norm(p.color)}`;
      
      // Si plusieurs produits ont la même clé, garder le premier (ou le plus récent)
      // En général, il ne devrait y avoir qu'un seul produit par modelRef+color
      if (!productByRefColor.has(refColorKey)) {
        productByRefColor.set(refColorKey, p);
      }
    }

    console.log(`[Upload] ${products?.length} produits en base, ${productByRefColor.size} combinaisons uniques (modelRef+color)`);

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

      // Extraire id, modelRef et color
      const id = row.id || row.ID || row.Id;
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF;
      const color = row.color || row.Color || row.COLOR;

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit UNIQUEMENT par modelRef + color (clé unique)
      // C'est plus simple et plus fiable
      const key = `${norm(modelRef)}|${norm(color)}`;
      const existing = productByRefColor.get(key);
      
      console.log(`[Row ${rowNum}] modelRef="${modelRef}", color="${color}" → ${existing ? "FOUND" : "NOT FOUND"}`);

      // Tracker le produit vu pour syncStock
      if (existing) {
        seenProductIds.add(existing.id);
      }

      if (!existing) {
        // NOUVEAU PRODUIT → L'INSÉRER
        // Générer un ID unique basé sur modelRef + color + timestamp
        const uniqueId = id || `${modelRef}-${color}-${Date.now()}`;
        
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
          priceRetail: parseFloat(String(row.priceRetail || 0).replace(",", ".")) || 0,
          priceWholesale: parseFloat(String(row.priceWholesale || 0).replace(",", ".")) || 0,
          stockQuantity: parseInt(String(row.stockQuantity || row.stock || 0)) || 0,
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
