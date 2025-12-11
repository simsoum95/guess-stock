import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// Supabase client avec service role pour les opérations admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChangeDetail {
  modelRef: string;
  color: string;
  field: string;
  oldValue: any;
  newValue: any;
}

interface UploadResult {
  success: boolean;
  updated: number;
  inserted: number;
  unchanged: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  notFound: Array<{ modelRef: string; color: string }>;
  changes: ChangeDetail[];
  totalRows: number;
}

// Normaliser une chaîne pour la comparaison
function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

// Parser un fichier Excel
function parseExcel(buffer: ArrayBuffer): any[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json(worksheet, { defval: null });
}

// Parser un fichier CSV
function parseCSV(text: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    });
  });
}

// Valider une ligne
function validateRow(row: any): { valid: boolean; error?: string } {
  const modelRef = row.modelRef || row.ModelRef || row.MODELREF || row.model_ref;
  const color = row.color || row.Color || row.COLOR;

  if (!modelRef || normalize(modelRef) === "") {
    return { valid: false, error: "modelRef חסר" };
  }
  if (!color || normalize(color) === "") {
    return { valid: false, error: "color חסר" };
  }
  return { valid: true };
}

// Extraire les champs d'une ligne
function extractFields(row: any): Record<string, any> {
  const fields: Record<string, any> = {};

  const columnMappings: Record<string, string[]> = {
    id: ["id", "ID", "Id"],
    collection: ["collection", "Collection", "COLLECTION"],
    category: ["category", "Category", "CATEGORY"],
    subcategory: ["subcategory", "Subcategory", "SUBCATEGORY", "sub_category"],
    brand: ["brand", "Brand", "BRAND"],
    modelRef: ["modelRef", "ModelRef", "MODELREF", "model_ref", "Model_Ref"],
    gender: ["gender", "Gender", "GENDER"],
    supplier: ["supplier", "Supplier", "SUPPLIER"],
    color: ["color", "Color", "COLOR"],
    priceRetail: ["priceRetail", "PriceRetail", "PRICERETAIL", "price_retail", "retail_price"],
    priceWholesale: ["priceWholesale", "PriceWholesale", "PRICEWHOLESALE", "price_wholesale", "wholesale_price"],
    stockQuantity: ["stockQuantity", "StockQuantity", "STOCKQUANTITY", "stock_quantity", "stock", "Stock", "STOCK"],
    imageUrl: ["imageUrl", "ImageUrl", "IMAGEURL", "image_url", "image"],
    gallery: ["gallery", "Gallery", "GALLERY"],
    productName: ["productName", "ProductName", "PRODUCTNAME", "product_name", "name", "Name"],
    size: ["size", "Size", "SIZE"],
  };

  for (const [fieldName, possibleKeys] of Object.entries(columnMappings)) {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        let value = row[key];

        if (fieldName === "priceRetail" || fieldName === "priceWholesale") {
          value = parseFloat(String(value).replace(",", ".")) || 0;
        } else if (fieldName === "stockQuantity") {
          value = parseInt(String(value)) || 0;
        } else if (fieldName === "gallery") {
          if (typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch {
              value = value.split(",").map((s: string) => s.trim()).filter(Boolean);
            }
          }
        }

        fields[fieldName] = value;
        break;
      }
    }
  }

  return fields;
}

// Noms des champs en hébreu
const fieldNamesHebrew: Record<string, string> = {
  stockQuantity: "מלאי",
  priceRetail: "מחיר קמעונאי",
  priceWholesale: "מחיר סיטונאי",
  productName: "שם מוצר",
  brand: "מותג",
  category: "קטגוריה",
  subcategory: "תת-קטגוריה",
  collection: "קולקציה",
  supplier: "ספק",
  gender: "מגדר",
  imageUrl: "תמונה",
  gallery: "גלריה",
  size: "מידה",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "לא נבחר קובץ" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, error: "פורמט קובץ לא נתמך. השתמש ב-CSV או XLSX" },
        { status: 400 }
      );
    }

    let rows: any[];
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      rows = parseExcel(buffer);
    } else {
      const text = await file.text();
      rows = await parseCSV(text);
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "הקובץ ריק או לא ניתן לקריאה" },
        { status: 400 }
      );
    }

    const result: UploadResult = {
      success: true,
      updated: 0,
      inserted: 0,
      unchanged: 0,
      errors: [],
      notFound: [],
      changes: [],
      totalRows: rows.length,
    };

    // Charger TOUS les champs des produits existants
    const { data: existingProducts, error: fetchError } = await supabase
      .from("products")
      .select("*");

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `שגיאת Supabase: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Créer un index avec toutes les données des produits
    const productIndex = new Map<string, any>();
    for (const p of existingProducts || []) {
      const key = `${normalize(p.modelRef)}|${normalize(p.color)}`;
      productIndex.set(key, p);
    }

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const validation = validateRow(row);
      if (!validation.valid) {
        result.errors.push({
          row: rowNum,
          message: validation.error || "שגיאה לא ידועה",
          data: row,
        });
        continue;
      }

      const fields = extractFields(row);
      const modelRef = fields.modelRef;
      const color = fields.color;
      const key = `${normalize(modelRef)}|${normalize(color)}`;

      const existingProduct = productIndex.get(key);
      
      // Debug log
      console.log(`[Row ${rowNum}] Looking for: modelRef="${modelRef}", color="${color}", key="${key}"`);
      console.log(`[Row ${rowNum}] Found: ${existingProduct ? "YES" : "NO"}`);

      if (existingProduct) {
        // Comparer les valeurs et ne mettre à jour que si elles ont changé
        const updateFields: Record<string, any> = {};
        const rowChanges: ChangeDetail[] = [];

        for (const [field, newValue] of Object.entries(fields)) {
          if (field === "modelRef" || field === "color") continue;
          if (newValue === undefined) continue;

          const oldValue = existingProduct[field];
          
          // Comparer les valeurs (en gérant les types)
          let hasChanged = false;
          if (field === "stockQuantity" || field === "priceRetail" || field === "priceWholesale") {
            hasChanged = Number(oldValue) !== Number(newValue);
          } else if (field === "gallery") {
            hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
          } else {
            hasChanged = String(oldValue || "") !== String(newValue || "");
          }

          if (hasChanged) {
            updateFields[field] = newValue;
            rowChanges.push({
              modelRef,
              color,
              field: fieldNamesHebrew[field] || field,
              oldValue: oldValue,
              newValue: newValue,
            });
          }
        }

        if (Object.keys(updateFields).length > 0) {
          // Il y a des changements réels - faire l'UPDATE
          const { error: updateError } = await supabase
            .from("products")
            .update(updateFields)
            .eq("modelRef", existingProduct.modelRef)
            .eq("color", existingProduct.color);

          if (updateError) {
            result.errors.push({
              row: rowNum,
              message: `שגיאת עדכון: ${updateError.message}`,
              data: { modelRef, color },
            });
          } else {
            result.updated++;
            result.changes.push(...rowChanges);
          }
        } else {
          // Pas de changement
          result.unchanged++;
        }
      } else {
        // Produit non trouvé - ajouter à la liste
        result.notFound.push({ modelRef, color });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: `שגיאה כללית: ${error.message}` },
      { status: 500 }
    );
  }
}
