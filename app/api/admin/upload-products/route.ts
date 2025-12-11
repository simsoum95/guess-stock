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
    console.log(`[Excel] Feuille "${sheetName}": ${rows.length} lignes`);
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
  return String(s).trim().toLowerCase().replace(/[-–—]/g, "-");
}

// Parser un nombre de manière sûre (gère virgules, points, espaces)
function parseNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  
  // Si c'est déjà un nombre
  if (typeof value === "number") {
    if (isNaN(value) || !isFinite(value)) return null;
    return value;
  }
  
  // Convertir en string et nettoyer
  let str = String(value).trim();
  
  // Supprimer les espaces et caractères non numériques (sauf , . -)
  str = str.replace(/\s/g, "");
  
  // Gérer le format français (1.234,56) vs anglais (1,234.56)
  // Si on a à la fois virgule et point, déterminer lequel est le séparateur décimal
  const hasComma = str.includes(",");
  const hasDot = str.includes(".");
  
  if (hasComma && hasDot) {
    // Format avec les deux : 1.234,56 ou 1,234.56
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    
    if (lastComma > lastDot) {
      // Format français : 1.234,56 → virgule est décimal
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Format anglais : 1,234.56 → point est décimal
      str = str.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Seulement virgule : pourrait être décimal (1,5) ou milliers (1,000)
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Probablement décimal : 1,5 ou 1,50
      str = str.replace(",", ".");
    } else {
      // Probablement milliers : 1,000
      str = str.replace(/,/g, "");
    }
  }
  // Si seulement point, c'est déjà bon
  
  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) return null;
  
  return num;
}

// Parser un entier de manière sûre
function parseInteger(value: any): number | null {
  const num = parseNumber(value);
  if (num === null) return null;
  return Math.round(num);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const syncStock = formData.get("syncStock") === "true";
    const updatePrices = formData.get("updatePrices") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "לא נבחר קובץ" }, { status: 400 });
    }

    console.log("[Upload] Fichier:", file.name);
    console.log("[Upload] Sync stock:", syncStock);
    console.log("[Upload] Update prices:", updatePrices);

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

    // Charger tous les produits
    const { data: products, error: fetchErr } = await supabase.from("products").select("*");
    
    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // Index pour recherche rapide
    // 1. Par ID exact
    const productById = new Map<string, any>();
    // 2. Par modelRef+color (peut avoir plusieurs produits)
    const productsByRefColor = new Map<string, any[]>();
    
    for (const p of products || []) {
      // Index par ID
      if (p.id) {
        productById.set(norm(p.id), p);
      }
      
      // Index par modelRef+color
      const key = `${norm(p.modelRef)}|${norm(p.color)}`;
      if (!productsByRefColor.has(key)) {
        productsByRefColor.set(key, []);
      }
      productsByRefColor.get(key)!.push(p);
    }

    console.log(`[Upload] ${products?.length} produits en base, ${productById.size} IDs uniques`);

    // Résultats
    let updated = 0;
    let inserted = 0;
    let unchanged = 0;
    let stockZeroed = 0;
    const changes: Change[] = [];
    const insertedProducts: Array<{ modelRef: string; color: string }> = [];
    const zeroedProducts: Array<{ modelRef: string; color: string; oldStock: number }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    const seenProductIds = new Set<string>();

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extraire les valeurs de la ligne avec plusieurs noms possibles
      const rowId = row.id || row.ID || row.Id || row.sku || row.SKU;
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF || row.model_ref || row.ref || row.Ref;
      const color = row.color || row.Color || row.COLOR;

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // STRATÉGIE DE MATCHING :
      // 1. D'abord essayer par ID exact (si fourni)
      // 2. Sinon par modelRef + color
      
      let existing: any = null;
      let matchedBy = "";

      // 1. Essayer par ID exact
      if (rowId) {
        existing = productById.get(norm(rowId));
        if (existing) matchedBy = "ID";
      }

      // 2. Sinon essayer par modelRef + color
      if (!existing) {
        const key = `${norm(modelRef)}|${norm(color)}`;
        const matchingProducts = productsByRefColor.get(key) || [];
        
        if (matchingProducts.length > 0) {
          existing = matchingProducts[0];
          matchedBy = "modelRef+color";
          
          // Marquer TOUS les produits avec ce modelRef+color comme "vus"
          for (const p of matchingProducts) {
            seenProductIds.add(p.id);
          }
        }
      }

      // Si toujours pas trouvé → nouveau produit
      if (!existing) {
        
        const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.stock ?? row.Stock;
        const parsedStock = parseInteger(stockRaw);
        const parsedRetail = parseNumber(row.priceRetail);
        const parsedWholesale = parseNumber(row.priceWholesale);
        
        const newProduct: Record<string, any> = {
          id: rowId || `${modelRef}-${color}-${Date.now()}`,
          modelRef: modelRef,
          color: color,
          brand: row.brand || row.Brand || "GUESS",
          subcategory: row.subcategory || row.category || row.Category || "תיק",
          category: row.subcategory || row.category || row.Category || "תיק",
          collection: row.collection || row.Collection || "",
          supplier: row.supplier || row.Supplier || "",
          gender: row.gender || row.Gender || "Women",
          priceRetail: parsedRetail ?? 0,
          priceWholesale: parsedWholesale ?? 0,
          stockQuantity: parsedStock ?? 0,
          imageUrl: "/images/default.png",
          gallery: [],
          productName: row.productName || modelRef,
        };

        const { error: insertErr } = await supabase.from("products").insert(newProduct);

        if (insertErr) {
          errors.push({ row: rowNum, message: `שגיאה בהוספה: ${insertErr.message}` });
        } else {
          inserted++;
          insertedProducts.push({ modelRef, color });
        }
        continue;
      }

      // Produit trouvé - le marquer comme vu
      seenProductIds.add(existing.id);

      // Préparer les mises à jour
      const updates: Record<string, any> = {};
      const rowChanges: Change[] = [];

      // STOCK - accepter noms tronqués aussi
      const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.stockQuanti ?? row.stock ?? row.Stock ?? row.מלאי;
      const newStock = parseInteger(stockRaw);
      
      if (newStock !== null) {
        const oldStock = existing.stockQuantity ?? 0;
        if (newStock !== oldStock) {
          updates.stockQuantity = newStock;
          rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldStock, newValue: newStock });
        }
      }

      // PRIX (seulement si l'option est activée)
      if (updatePrices) {
        // Prix de détail
        const newRetail = parseNumber(row.priceRetail ?? row.PriceRetail);
        if (newRetail !== null) {
          const oldVal = existing.priceRetail ?? 0;
          if (Math.abs(newRetail - oldVal) > 0.01) {
            updates.priceRetail = newRetail;
            rowChanges.push({ modelRef, color, field: "מחיר קמעונאי", oldValue: oldVal, newValue: newRetail });
          }
        }
        
        // Prix de gros
        const newWholesale = parseNumber(row.priceWholesale ?? row.PriceWholesale ?? row.priceWholesa);
        if (newWholesale !== null) {
          const oldVal = existing.priceWholesale ?? 0;
          if (Math.abs(newWholesale - oldVal) > 0.01) {
            updates.priceWholesale = newWholesale;
            rowChanges.push({ modelRef, color, field: "מחיר סיטונאי", oldValue: oldVal, newValue: newWholesale });
          }
        }
      }

      // Appliquer les mises à jour
      if (Object.keys(updates).length > 0) {
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

    // SYNCHRONISATION STOCK - Les produits manquants passent à 0
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
      }
    }

    console.log(`[Upload] Terminé: ${updated} mis à jour, ${inserted} ajoutés, ${unchanged} inchangés, ${stockZeroed} à 0`);

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
      updatePricesEnabled: updatePrices,
    });

  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
