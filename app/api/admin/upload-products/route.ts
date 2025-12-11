import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// Supabase client avec service role pour les opérations admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Colonnes supportées
const SUPPORTED_COLUMNS = [
  "id", "collection", "category", "subcategory", "brand", "modelRef",
  "gender", "supplier", "color", "priceRetail", "priceWholesale",
  "stockQuantity", "imageUrl", "gallery", "productName", "size"
];

// Colonnes requises
const REQUIRED_COLUMNS = ["modelRef", "color"];

interface UploadResult {
  success: boolean;
  updated: number;
  inserted: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  notFound: string[];
  totalRows: number;
}

// Normaliser une chaîne pour la comparaison
function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-") // Normaliser les tirets
    .replace(/\s+/g, " "); // Normaliser les espaces
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
      error: (error) => reject(error),
    });
  });
}

// Valider une ligne
function validateRow(row: any, rowIndex: number): { valid: boolean; error?: string } {
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

// Extraire les champs d'une ligne (insensible à la casse)
function extractFields(row: any): Record<string, any> {
  const fields: Record<string, any> = {};

  // Mapper les colonnes (supporter différentes casses)
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

        // Convertir les types
        if (fieldName === "priceRetail" || fieldName === "priceWholesale") {
          value = parseFloat(String(value).replace(",", ".")) || 0;
        } else if (fieldName === "stockQuantity") {
          value = parseInt(String(value)) || 0;
        } else if (fieldName === "gallery") {
          // Gallery peut être une chaîne JSON ou séparée par des virgules
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

    // Déterminer le type de fichier
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, error: "פורמט קובץ לא נתמך. השתמש ב-CSV או XLSX" },
        { status: 400 }
      );
    }

    // Parser le fichier
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

    // Résultats
    const result: UploadResult = {
      success: true,
      updated: 0,
      inserted: 0,
      errors: [],
      notFound: [],
      totalRows: rows.length,
    };

    // Charger tous les produits existants pour un matching efficace
    const { data: existingProducts, error: fetchError } = await supabase
      .from("products")
      .select("modelRef, color");

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `שגיאת Supabase: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Créer un index pour le matching rapide
    const productIndex = new Map<string, boolean>();
    for (const p of existingProducts || []) {
      const key = `${normalize(p.modelRef)}|${normalize(p.color)}`;
      productIndex.set(key, true);
    }

    // Traiter chaque ligne
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 car Excel commence à 1 et header est ligne 1

      // Valider la ligne
      const validation = validateRow(row, rowNum);
      if (!validation.valid) {
        result.errors.push({
          row: rowNum,
          message: validation.error || "שגיאה לא ידועה",
          data: row,
        });
        continue;
      }

      // Extraire les champs
      const fields = extractFields(row);
      const modelRef = fields.modelRef;
      const color = fields.color;
      const key = `${normalize(modelRef)}|${normalize(color)}`;

      // Vérifier si le produit existe
      const exists = productIndex.has(key);

      if (exists) {
        // UPDATE - Ne mettre à jour que les champs fournis
        const updateFields: Record<string, any> = {};
        for (const [field, value] of Object.entries(fields)) {
          if (field !== "modelRef" && field !== "color" && value !== undefined) {
            updateFields[field] = value;
          }
        }

        if (Object.keys(updateFields).length > 0) {
          const { error: updateError } = await supabase
            .from("products")
            .update(updateFields)
            .ilike("modelRef", modelRef)
            .ilike("color", color);

          if (updateError) {
            result.errors.push({
              row: rowNum,
              message: `שגיאת עדכון: ${updateError.message}`,
              data: { modelRef, color },
            });
          } else {
            result.updated++;
          }
        }
      } else {
        // INSERT - Créer un nouveau produit
        const newProduct = {
          id: fields.id || `${modelRef}-${color}-${Date.now()}`,
          modelRef,
          color,
          collection: fields.collection || null,
          category: fields.category || fields.subcategory || null,
          subcategory: fields.subcategory || null,
          brand: fields.brand || "GUESS",
          gender: fields.gender || null,
          supplier: fields.supplier || null,
          priceRetail: fields.priceRetail || 0,
          priceWholesale: fields.priceWholesale || 0,
          stockQuantity: fields.stockQuantity || 0,
          imageUrl: fields.imageUrl || "/images/default.png",
          gallery: fields.gallery || [],
          productName: fields.productName || modelRef,
          size: fields.size || null,
        };

        const { error: insertError } = await supabase
          .from("products")
          .insert(newProduct);

        if (insertError) {
          result.errors.push({
            row: rowNum,
            message: `שגיאת הוספה: ${insertError.message}`,
            data: { modelRef, color },
          });
        } else {
          result.inserted++;
          // Ajouter au index pour éviter les doublons dans le même fichier
          productIndex.set(key, true);
        }
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

