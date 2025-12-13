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

// Normaliser la catégorie à partir de la sous-catégorie
function normalizeCategoryFromSubcategory(subcat: string): string {
  if (!subcat) return "תיק";
  
  const normalized = subcat.trim();
  
  // Mapping des sous-catégories vers les catégories principales
  const subcategoryToCategory: Record<string, string> = {
    // תיק (sacs)
    "תיק": "תיק",
    "תיק צד": "תיק",
    "תיק נשיאה": "תיק",
    "תיק גב": "תיק",
    "תיק נסיעות": "תיק",
    "תיק ערב": "תיק",
    "ארנקים": "תיק",
    "מזוודות": "תיק",
    "מחזיק מפתחות": "תיק",
    
    // נעל (chaussures)
    "נעל": "נעל",
    "נעליים שטוחו": "נעל",
    "נעלי עקב": "נעל",
    "סניקרס": "נעל",
    "כפכפים": "נעל",
    "סנדלים": "נעל",
    "מגפיים": "נעל",
    
    // ביגוד (vêtements)
    "ביגוד": "ביגוד",
    "טישירט": "ביגוד",
    "סווטשירט": "ביגוד",
    "חולצות": "ביגוד",
    "טופים": "ביגוד",
    "ג'קטים ומעיל": "ביגוד",
    "ג'ינסים": "ביגוד",
    "מכנסיים": "ביגוד",
    "מכנסי טרנינג": "ביגוד",
    "חצאיות": "ביגוד",
    "שמלות ואוברו": "ביגוד",
    "צעיפים": "ביגוד",
    "כובעים": "ביגוד",
    "סט new born": "ביגוד",
    "סט NEW BORN": "ביגוד",
  };
  
  // Vérifier d'abord le mapping direct
  if (subcategoryToCategory[normalized]) {
    return subcategoryToCategory[normalized];
  }
  
  // Vérifier si ça commence par une catégorie principale
  if (normalized.startsWith("תיק")) return "תיק";
  if (normalized.startsWith("נעל")) return "נעל";
  if (normalized.startsWith("ביגוד")) return "ביגוד";
  
  // Vérifier les mots-clés spécifiques (insensible à la casse)
  const lower = normalized.toLowerCase();
  if (lower.includes("ארנק") || lower.includes("מזווד") || lower.includes("מחזיק מפתחות")) return "תיק";
  if (lower.includes("סניקר") || lower.includes("כפכף") || lower.includes("סנדל") || lower.includes("מגפ")) return "נעל";
  if (lower.includes("טישירט") || lower.includes("סווטשירט") || lower.includes("חולצ") || 
      lower.includes("ג'קט") || lower.includes("ג'ינס") || lower.includes("מכנס") || 
      lower.includes("חצאית") || lower.includes("שמלה") || lower.includes("צעיף") || 
      lower.includes("כובע") || lower.includes("new born")) return "ביגוד";
  
  // Par défaut
  return "תיק";
}

// Parsing intelligent des nombres - gère automatiquement points ET virgules
// Compatible Excel (virgules) et Google Sheets (points)
function parseNumberIntelligent(value: any, isDecimal: boolean = false): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  
  // Convertir en string et nettoyer
  let cleaned = String(value).trim();
  
  // Enlever les espaces
  cleaned = cleaned.replace(/\s/g, "");
  
  // Détecter le format : si virgule ET point, la virgule est probablement un séparateur de milliers
  // Exemples :
  // - "1.234,56" (format européen) → virgule = décimal, point = milliers
  // - "1,234.56" (format US) → point = décimal, virgule = milliers
  // - "1234,56" → virgule = décimal
  // - "1234.56" → point = décimal
  
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  
  if (hasComma && hasDot) {
    // Les deux présents : déterminer lequel est le séparateur décimal
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    
    if (lastComma > lastDot) {
      // "1.234,56" → format européen (virgule = décimal)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,234.56" → format US (point = décimal)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Seulement virgule : peut être décimal ou milliers
    // Si c'est un entier, on enlève juste la virgule
    // Si c'est un décimal, on remplace par un point
    if (isDecimal) {
      cleaned = cleaned.replace(",", ".");
    } else {
      // Pour les entiers, on enlève la virgule (probablement un séparateur de milliers)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasDot && !isDecimal) {
    // Point dans un entier : probablement un séparateur de milliers
    // Mais on garde pour parseInt qui va l'ignorer
    cleaned = cleaned.replace(/\./g, "");
  }
  // Si seulement point et isDecimal = true, on garde tel quel
  
  // Parser
  const parsed = isDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
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

    // Index par modelRef + color (PRIORITÉ) - comme l'ancienne version
    // Si plusieurs produits ont le même modelRef+color, on les stocke tous
    const productByRefColor = new Map<string, any[]>(); // modelRef + color (peut avoir plusieurs produits)
    const productById = new Map<string, any>(); // ID (utilisé seulement si modelRef+color a plusieurs résultats)
    
    for (const p of products || []) {
      // Index par modelRef + color (PRIORITÉ)
      const refColorKey = `${norm(p.modelRef)}|${norm(p.color)}`;
      if (!productByRefColor.has(refColorKey)) {
        productByRefColor.set(refColorKey, []);
      }
      productByRefColor.get(refColorKey)!.push(p);
      
      // Index par ID (seulement pour différencier les doublons modelRef+color)
      if (p.id && p.id !== "GUESS") {
        productById.set(norm(p.id), p);
      }
    }

    console.log(`[Upload] ${products?.length} produits en base`);
    console.log(`[Upload] ${productByRefColor.size} combinaisons modelRef+color (${Array.from(productByRefColor.values()).filter(arr => arr.length > 1).length} avec doublons)`);

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
      // Support hébreu complet
      const id = row.id || row.ID || row.Id || row["מזהה"] || row["מק\"ט מלא"] || row["מק״ט מלא"] || row["מזהה מלא"];
      const modelRef = row.modelRef || row.ModelRef || row.MODELREF || row["מק״ט"] || row["מק\"ט"] || row["קוד גם"] || row["קוד"] || row["model"] || row["Model"];
      const color = row.color || row.Color || row.COLOR || row["צבע"] || row["colour"];

      if (!modelRef || !color) {
        errors.push({ row: rowNum, message: "modelRef או color חסר" });
        continue;
      }

      // Chercher le produit: PRIORITÉ au modelRef + color (comme l'ancienne version)
      // Seulement si plusieurs produits ont le même modelRef+color, on utilise l'ID pour différencier
      let existing = null;
      let matchedBy = "";
      
      // 1. D'abord chercher par modelRef + color (PRIORITÉ)
      const key = `${norm(modelRef)}|${norm(color)}`;
      const candidates = productByRefColor.get(key) || [];
      
      if (candidates.length === 1) {
        // Un seul produit avec ce modelRef+color → C'EST LE BON
        existing = candidates[0];
        matchedBy = "modelRef+color";
        console.log(`[Row ${rowNum}] Matched by modelRef+color: "${modelRef}" / "${color}"`);
      } else if (candidates.length > 1) {
        // Plusieurs produits avec le même modelRef+color → Utiliser l'ID pour différencier
        if (id) {
          const foundById = productById.get(norm(id));
          if (foundById) {
            existing = foundById;
            matchedBy = "modelRef+color+id (doublon résolu par ID)";
            console.log(`[Row ${rowNum}] Matched by modelRef+color+id: "${modelRef}" / "${color}" / "${id}" (${candidates.length} doublons)`);
          } else {
            // ID fourni mais pas trouvé parmi les doublons
            errors.push({ 
              row: rowNum, 
              message: `Plusieurs produits avec modelRef="${modelRef}" et color="${color}". ID "${id}" non trouvé parmi eux.` 
            });
            continue;
          }
        } else {
          // Pas d'ID fourni mais plusieurs produits → Prendre le premier
          existing = candidates[0];
          matchedBy = `modelRef+color (${candidates.length} doublons, pris le premier - ID recommandé)`;
          console.log(`[Row ${rowNum}] ⚠️  Plusieurs produits avec "${modelRef}" / "${color}". Pris le premier (ID: ${existing.id})`);
        }
      }
      
      console.log(`[Row ${rowNum}] modelRef="${modelRef}", color="${color}", id="${id || 'N/A'}" → ${matchedBy || "NOT FOUND"}`);

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
          brand: row.brand || row.Brand || row["מותג"] || "GUESS",
          subcategory: (() => {
            const subcat = row.subcategory || row.category || row.Category || row["תת משפחה"] || row["תת-משפחה"] || row["קטגוריה"] || "תיק";
            return String(subcat).trim();
          })(),
          category: (() => {
            // Normaliser la catégorie à partir de la sous-catégorie
            const subcat = row.subcategory || row.category || row.Category || row["תת משפחה"] || row["תת-משפחה"] || row["קטגוריה"] || "תיק";
            return normalizeCategoryFromSubcategory(String(subcat).trim());
          })(),
          collection: row.collection || row.Collection || row["קולקציה"] || "",
          supplier: row.supplier || row.Supplier || row["ספק"] || "",
          gender: row.gender || row.Gender || row["מגדר"] || "Women",
          priceRetail: parseNumberIntelligent(
            row.priceRetail || row["מחיר כולל מע\"מ בסיס"] || row["מחיר כולל מע״מ בסיס"] || row["מחיר קמעונאי"] || row["מחיר"] || 0, 
            true
          ),
          priceWholesale: parseNumberIntelligent(
            row.priceWholesale || row["סיטונאי"] || row["מחיר סיטונאי"] || 0, 
            true
          ),
          stockQuantity: parseNumberIntelligent(
            row.stockQuantity || row.stock || row["כמות מלאי נוכחי"] || row["מלאי"] || row["כמות"] || 0, 
            false
          ),
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

      // stockQuantity - Parsing intelligent qui gère points ET virgules (Excel + Google Sheets)
      // Support hébreu : כמות מלאי נוכחי, מלאי, כמות
      const stockRaw = row.stockQuantity ?? row.StockQuantity ?? row.STOCKQUANTITY ?? row.stock ?? row.Stock ?? row["כמות מלאי נוכחי"] ?? row["מלאי"] ?? row["כמות"];
      if (stockRaw !== undefined && stockRaw !== null && stockRaw !== "") {
        // Parsing intelligent : gère les points ET les virgules comme séparateurs décimaux
        const newVal = parseNumberIntelligent(stockRaw);
        
        // Validation : stock doit être un nombre valide entre 0 et 10000
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Stock invalide: "${stockRaw}" (doit être un nombre)` });
          continue;
        }
        
        if (newVal < 0) {
          errors.push({ row: rowNum, message: `Stock négatif: ${newVal} (mis à 0)` });
          updates.stockQuantity = 0;
        } else if (newVal > 10000) {
          errors.push({ row: rowNum, message: `Stock suspect (>10000): ${newVal}. Vérifiez la valeur.` });
          updates.stockQuantity = newVal;
        } else {
          const oldVal = parseInt(String(existing.stockQuantity || 0), 10) || 0;
          if (newVal !== oldVal) {
            updates.stockQuantity = newVal;
            rowChanges.push({ modelRef, color, field: "מלאי", oldValue: oldVal, newValue: newVal });
          }
        }
        console.log(`[Row ${rowNum}] Stock: file="${stockRaw}" → parsed=${newVal}, db=${existing.stockQuantity}`);
      }

      // priceRetail - Parsing intelligent (points ET virgules)
      // Support hébreu : מחיר כולל מע"מ בסיס, מחיר קמעונאי, מחיר
      const priceRetailRaw = row.priceRetail ?? row.PriceRetail ?? row["מחיר כולל מע\"מ בסיס"] ?? row["מחיר כולל מע״מ בסיס"] ?? row["מחיר קמעונאי"] ?? row["מחיר"];
      if (priceRetailRaw !== undefined && priceRetailRaw !== null && priceRetailRaw !== "") {
        const newVal = parseNumberIntelligent(priceRetailRaw, true);
        
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Prix retail invalide: "${priceRetailRaw}"` });
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

      // priceWholesale - Parsing intelligent (points ET virgules)
      // Support hébreu : סיטונאי, מחיר סיטונאי
      const priceWholesaleRaw = row.priceWholesale ?? row.PriceWholesale ?? row["סיטונאי"] ?? row["מחיר סיטונאי"];
      if (priceWholesaleRaw !== undefined && priceWholesaleRaw !== null && priceWholesaleRaw !== "") {
        const newVal = parseNumberIntelligent(priceWholesaleRaw, true);
        
        if (isNaN(newVal) || !isFinite(newVal)) {
          errors.push({ row: rowNum, message: `Prix wholesale invalide: "${priceWholesaleRaw}"` });
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
