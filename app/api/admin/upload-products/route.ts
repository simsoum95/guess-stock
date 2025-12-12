import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPES - Définitions strictes
// ============================================================================

interface Product {
  id: string;
  collection: string;
  category: string;
  subcategory: string;
  brand: string;
  modelRef: string;
  gender: string;
  supplier: string;
  color: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery: string[];
  productName: string;
  size: string;
}

interface UploadRow {
  [key: string]: unknown;
}

interface NormalizedRow {
  id: string;
  modelRef: string;
  color: string;
  size: string;
  stockQuantity: number;
  collection: string;
  category: string;
  subcategory: string;
  brand: string;
  gender: string;
  supplier: string;
  priceRetail: number;
  priceWholesale: number;
  imageUrl: string;
  productName: string;
  rowNumber: number;
  originalData: UploadRow;
}

interface MatchResult {
  product: Product;
  productIndex: number;
  matchType: "id" | "modelRef+color+size" | "modelRef+color" | "modelRef";
  confidence: number;
}

interface UpdateOperation {
  rowNumber: number;
  productId: string;
  productIndex: number;
  modelRef: string;
  color: string;
  size: string;
  oldStock: number;
  newStock: number;
  matchType: string;
  confidence: number;
}

interface CreateOperation {
  rowNumber: number;
  newProduct: Product;
}

interface NotFoundItem {
  rowNumber: number;
  modelRef: string;
  color: string;
  size: string;
  requestedStock: number;
  reason: string;
  suggestions: string[];
}

interface ErrorItem {
  rowNumber: number;
  message: string;
  data: unknown;
}

interface ProcessingResult {
  success: boolean;
  dryRun: boolean;
  backupPath: string | null;
  summary: {
    totalRows: number;
    validRows: number;
    toUpdate: number;
    toCreate: number;
    notFound: number;
    errors: number;
    duplicatesInFile: number;
  };
  operations: UpdateOperation[];
  creations: CreateOperation[];
  notFound: NotFoundItem[];
  errors: ErrorItem[];
  duplicatesInFile: Array<{
    rowNumbers: number[];
    modelRef: string;
    color: string;
    size: string;
  }>;
}

// ============================================================================
// UTILITAIRES - Fonctions de normalisation et validation
// ============================================================================

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extractStock(value: unknown): { valid: boolean; value: number; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { valid: false, value: 0, error: "ערך מלאי חסר" };
  }

  const strValue = String(value).trim();
  
  if (!/^-?\d+(\.\d+)?$/.test(strValue)) {
    return { valid: false, value: 0, error: `ערך מלאי לא תקין: "${value}"` };
  }

  const numValue = parseFloat(strValue);
  
  if (isNaN(numValue)) {
    return { valid: false, value: 0, error: `ערך מלאי לא תקין: "${value}"` };
  }

  if (numValue < 0) {
    return { valid: false, value: 0, error: `מלאי לא יכול להיות שלילי: ${numValue}` };
  }

  const roundedValue = Math.round(numValue);
  
  if (roundedValue > 999999) {
    return { valid: false, value: 0, error: `מלאי גדול מדי: ${roundedValue}` };
  }

  return { valid: true, value: roundedValue };
}

function extractPrice(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const strValue = String(value).trim().replace(/[^\d.-]/g, "");
  const numValue = parseFloat(strValue);
  return isNaN(numValue) ? 0 : Math.max(0, numValue);
}

function findColumnValue(row: UploadRow, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
      return row[name];
    }
  }
  
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase();
    const foundKey = rowKeys.find(k => k.toLowerCase() === normalizedName);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
      return row[foundKey];
    }
  }
  
  return undefined;
}

function normalizeRow(row: UploadRow, rowNumber: number): { valid: boolean; data?: NormalizedRow; error?: string } {
  const idValue = findColumnValue(row, ["id", "ID", "Id", "מזהה"]);
  const modelRefValue = findColumnValue(row, ["modelRef", "ModelRef", "model_ref", "reference", "Reference", "ref", "Ref", "מקט", "מק״ט", "SKU", "sku"]);
  const colorValue = findColumnValue(row, ["color", "Color", "colour", "Colour", "צבע"]);
  const sizeValue = findColumnValue(row, ["size", "Size", "מידה", "taille", "Taille"]);
  const stockValue = findColumnValue(row, ["stockQuantity", "StockQuantity", "stock_quantity", "stock", "Stock", "quantity", "Quantity", "מלאי", "כמות", "qty", "Qty", "QTY"]);
  
  // Champs additionnels pour création
  const collectionValue = findColumnValue(row, ["collection", "Collection", "קולקציה"]);
  const categoryValue = findColumnValue(row, ["category", "Category", "קטגוריה"]);
  const subcategoryValue = findColumnValue(row, ["subcategory", "Subcategory", "תת-קטגוריה"]);
  const brandValue = findColumnValue(row, ["brand", "Brand", "מותג"]);
  const genderValue = findColumnValue(row, ["gender", "Gender", "מגדר"]);
  const supplierValue = findColumnValue(row, ["supplier", "Supplier", "ספק"]);
  const priceRetailValue = findColumnValue(row, ["priceRetail", "PriceRetail", "price_retail", "price", "Price", "מחיר", "מחיר קמעונאי"]);
  const priceWholesaleValue = findColumnValue(row, ["priceWholesale", "PriceWholesale", "price_wholesale", "wholesale", "מחיר סיטונאי"]);
  const imageUrlValue = findColumnValue(row, ["imageUrl", "ImageUrl", "image_url", "image", "Image", "תמונה"]);
  const productNameValue = findColumnValue(row, ["productName", "ProductName", "product_name", "name", "Name", "שם", "שם מוצר"]);

  const id = normalizeString(idValue);
  const modelRef = normalizeString(modelRefValue);
  const color = String(colorValue || "").trim();
  const size = String(sizeValue || "").trim();

  if (!modelRef && !id) {
    return { 
      valid: false, 
      error: `שורה ${rowNumber}: חייב להיות מק״ט או מזהה` 
    };
  }

  const stockResult = extractStock(stockValue);
  if (!stockResult.valid) {
    return { 
      valid: false, 
      error: `שורה ${rowNumber}: ${stockResult.error}` 
    };
  }

  return {
    valid: true,
    data: {
      id,
      modelRef: modelRef || id,
      color,
      size,
      stockQuantity: stockResult.value,
      collection: String(collectionValue || "").trim(),
      category: String(categoryValue || "").trim(),
      subcategory: String(subcategoryValue || "").trim(),
      brand: String(brandValue || "GUESS").trim(),
      gender: String(genderValue || "").trim(),
      supplier: String(supplierValue || "").trim(),
      priceRetail: extractPrice(priceRetailValue),
      priceWholesale: extractPrice(priceWholesaleValue),
      imageUrl: String(imageUrlValue || "/images/default.png").trim(),
      productName: String(productNameValue || modelRefValue || "").trim(),
      rowNumber,
      originalData: row
    }
  };
}

// ============================================================================
// MATCHING - Algorithme de correspondance multi-niveau
// ============================================================================

function createProductKey(modelRef: string, color: string, size: string): string {
  return `${normalizeString(modelRef)}|${normalizeString(color)}|${normalizeString(size)}`;
}

function findBestMatch(
  row: NormalizedRow,
  products: Product[],
  productIndexMap: Map<string, number>
): MatchResult | null {
  
  // NIVEAU 1: Match par ID exact (confiance 100%)
  if (row.id) {
    for (let i = 0; i < products.length; i++) {
      if (normalizeString(products[i].id) === row.id) {
        return {
          product: products[i],
          productIndex: i,
          matchType: "id",
          confidence: 100
        };
      }
    }
  }

  const rowModelRef = normalizeString(row.modelRef);
  const rowColor = normalizeString(row.color);
  const rowSize = normalizeString(row.size);

  // NIVEAU 2: Match par modelRef + color + size (confiance 95%)
  if (rowModelRef && rowColor && rowSize) {
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (
        normalizeString(p.modelRef) === rowModelRef &&
        normalizeString(p.color) === rowColor &&
        normalizeString(p.size) === rowSize
      ) {
        return {
          product: p,
          productIndex: i,
          matchType: "modelRef+color+size",
          confidence: 95
        };
      }
    }
  }

  // NIVEAU 3: Match par modelRef + color (confiance 85%)
  if (rowModelRef && rowColor) {
    const matches: Array<{ product: Product; index: number }> = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (
        normalizeString(p.modelRef) === rowModelRef &&
        normalizeString(p.color) === rowColor
      ) {
        matches.push({ product: p, index: i });
      }
    }
    
    if (matches.length === 1) {
      return {
        product: matches[0].product,
        productIndex: matches[0].index,
        matchType: "modelRef+color",
        confidence: 85
      };
    }
    
    if (matches.length > 1 && !rowSize) {
      const noSizeMatches = matches.filter(m => !m.product.size || m.product.size === "");
      if (noSizeMatches.length === 1) {
        return {
          product: noSizeMatches[0].product,
          productIndex: noSizeMatches[0].index,
          matchType: "modelRef+color",
          confidence: 80
        };
      }
    }
  }

  // NIVEAU 4: Match par modelRef seul (confiance 70%)
  if (rowModelRef) {
    const matches: Array<{ product: Product; index: number }> = [];
    for (let i = 0; i < products.length; i++) {
      if (normalizeString(products[i].modelRef) === rowModelRef) {
        matches.push({ product: products[i], index: i });
      }
    }
    
    if (matches.length === 1) {
      return {
        product: matches[0].product,
        productIndex: matches[0].index,
        matchType: "modelRef",
        confidence: 70
      };
    }
  }

  return null;
}

function generateSuggestions(row: NormalizedRow, products: Product[]): string[] {
  const suggestions: string[] = [];
  const rowModelRef = normalizeString(row.modelRef);
  
  if (!rowModelRef) return suggestions;

  const sameRefProducts = products.filter(
    p => normalizeString(p.modelRef) === rowModelRef
  );

  if (sameRefProducts.length > 1) {
    suggestions.push(`נמצאו ${sameRefProducts.length} מוצרים עם מק״ט "${row.modelRef}":`);
    sameRefProducts.slice(0, 5).forEach(p => {
      const details = [p.color, p.size].filter(Boolean).join(" / ");
      suggestions.push(`  • ${p.id}: ${details || "ללא צבע/מידה"}`);
    });
    if (sameRefProducts.length > 5) {
      suggestions.push(`  ... ועוד ${sameRefProducts.length - 5} מוצרים`);
    }
  }

  return suggestions;
}

// ============================================================================
// GÉNÉRATION D'ID UNIQUE
// ============================================================================

function generateUniqueId(products: Product[], modelRef: string, color: string, existingNewIds: Set<string>): string {
  const baseId = modelRef.toUpperCase();
  const colorSuffix = color ? `_${color.replace(/\s+/g, "_").substring(0, 10).toUpperCase()}` : "";
  
  let candidateId = baseId + colorSuffix;
  let counter = 0;
  
  const allExistingIds = new Set([
    ...products.map(p => p.id.toUpperCase()),
    ...Array.from(existingNewIds).map(id => id.toUpperCase())
  ]);
  
  while (allExistingIds.has(candidateId.toUpperCase())) {
    counter++;
    candidateId = `${baseId}${colorSuffix}_${counter}`;
  }
  
  return candidateId;
}

// ============================================================================
// BACKUP - Système de sauvegarde
// ============================================================================

function createBackup(productsPath: string): string | null {
  try {
    const backupDir = path.join(process.cwd(), "data", "backups");
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `products-backup-${timestamp}.json`);

    fs.copyFileSync(productsPath, backupPath);
    
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("products-backup-"))
      .sort()
      .reverse();
    
    if (backups.length > 50) {
      backups.slice(50).forEach(oldBackup => {
        fs.unlinkSync(path.join(backupDir, oldBackup));
      });
    }

    return backupPath;
  } catch (error) {
    console.error("Erreur création backup:", error);
    return null;
  }
}

// ============================================================================
// PARSING - Lecture des fichiers Excel/CSV
// ============================================================================

function parseExcel(buffer: ArrayBuffer): UploadRow[] {
  const workbook = XLSX.read(buffer, { 
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("הקובץ לא מכיל גיליונות");
  }
  
  const worksheet = workbook.Sheets[firstSheetName];
  
  const data = XLSX.utils.sheet_to_json<UploadRow>(worksheet, {
    defval: "",
    raw: true,
    blankrows: false
  });
  
  return data;
}

function parseCSV(text: string): UploadRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error("הקובץ חייב להכיל לפחות שורת כותרות ושורת נתונים אחת");
  }

  const headers = parseCSVLine(lines[0]);
  
  if (headers.length === 0) {
    throw new Error("לא נמצאו עמודות בקובץ");
  }

  const data: UploadRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.every(v => !v.trim())) continue;
    
    const row: UploadRow = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });
    
    data.push(row);
  }
  
  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// ============================================================================
// TRAITEMENT PRINCIPAL
// ============================================================================

async function processUpload(
  fileBuffer: ArrayBuffer | string,
  isExcel: boolean,
  dryRun: boolean
): Promise<ProcessingResult> {
  
  const productsPath = path.join(process.cwd(), "data", "products.json");
  
  if (!fs.existsSync(productsPath)) {
    throw new Error("קובץ המוצרים לא נמצא");
  }

  let products: Product[];
  try {
    const productsData = fs.readFileSync(productsPath, "utf-8");
    products = JSON.parse(productsData);
  } catch (error) {
    throw new Error("שגיאה בקריאת קובץ המוצרים");
  }

  if (!Array.isArray(products)) {
    throw new Error("פורמט קובץ המוצרים לא תקין");
  }

  const productIndexMap = new Map<string, number>();
  products.forEach((p, index) => {
    productIndexMap.set(p.id, index);
  });

  let uploadedRows: UploadRow[];
  try {
    if (isExcel) {
      uploadedRows = parseExcel(fileBuffer as ArrayBuffer);
    } else {
      uploadedRows = parseCSV(fileBuffer as string);
    }
  } catch (error) {
    throw new Error(`שגיאה בקריאת הקובץ: ${error instanceof Error ? error.message : "שגיאה לא ידועה"}`);
  }

  if (uploadedRows.length === 0) {
    throw new Error("הקובץ ריק או לא מכיל נתונים תקינים");
  }

  const normalizedRows: NormalizedRow[] = [];
  const errors: ErrorItem[] = [];

  for (let i = 0; i < uploadedRows.length; i++) {
    const rowNumber = i + 2;
    const result = normalizeRow(uploadedRows[i], rowNumber);
    
    if (result.valid && result.data) {
      normalizedRows.push(result.data);
    } else {
      errors.push({
        rowNumber,
        message: result.error || "שגיאה לא ידועה",
        data: uploadedRows[i]
      });
    }
  }

  // Détection des doublons
  const seenKeys = new Map<string, number[]>();
  const duplicatesInFile: Array<{
    rowNumbers: number[];
    modelRef: string;
    color: string;
    size: string;
  }> = [];

  normalizedRows.forEach(row => {
    const key = createProductKey(row.modelRef, row.color, row.size);
    const existing = seenKeys.get(key);
    if (existing) {
      existing.push(row.rowNumber);
    } else {
      seenKeys.set(key, [row.rowNumber]);
    }
  });

  seenKeys.forEach((rowNumbers, key) => {
    if (rowNumbers.length > 1) {
      const [modelRef, color, size] = key.split("|");
      duplicatesInFile.push({
        rowNumbers,
        modelRef,
        color,
        size
      });
      
      rowNumbers.slice(1).forEach(rowNum => {
        errors.push({
          rowNumber: rowNum,
          message: `שורה כפולה - אותו מוצר מופיע גם בשורה ${rowNumbers[0]}`,
          data: null
        });
      });
    }
  });

  const uniqueRows = normalizedRows.filter(row => {
    const key = createProductKey(row.modelRef, row.color, row.size);
    const rowNumbers = seenKeys.get(key);
    return rowNumbers && rowNumbers[0] === row.rowNumber;
  });

  // Matching et création
  const operations: UpdateOperation[] = [];
  const creations: CreateOperation[] = [];
  const notFound: NotFoundItem[] = [];
  const usedProductIndices = new Set<number>();
  const newProductIds = new Set<string>();

  for (const row of uniqueRows) {
    const match = findBestMatch(row, products, productIndexMap);
    
    if (match) {
      if (usedProductIndices.has(match.productIndex)) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `המוצר ${match.product.id} כבר עודכן בקובץ זה`,
          data: row.originalData
        });
        continue;
      }
      
      usedProductIndices.add(match.productIndex);
      
      operations.push({
        rowNumber: row.rowNumber,
        productId: match.product.id,
        productIndex: match.productIndex,
        modelRef: match.product.modelRef,
        color: match.product.color,
        size: match.product.size,
        oldStock: match.product.stockQuantity,
        newStock: row.stockQuantity,
        matchType: match.matchType,
        confidence: match.confidence
      });
    } else {
      // Vérifier s'il y a plusieurs produits avec le même modelRef
      const rowModelRef = normalizeString(row.modelRef);
      const sameRefProducts = products.filter(
        p => normalizeString(p.modelRef) === rowModelRef
      );
      
      if (sameRefProducts.length > 1) {
        // Plusieurs produits avec même ref = ambiguïté, ne pas créer
        const suggestions = generateSuggestions(row, products);
        notFound.push({
          rowNumber: row.rowNumber,
          modelRef: row.modelRef,
          color: row.color,
          size: row.size,
          requestedStock: row.stockQuantity,
          reason: "נמצאו מספר מוצרים עם אותו מק״ט - יש לציין צבע/מידה מדויקים",
          suggestions
        });
      } else {
        // Aucun produit trouvé OU un seul produit mais pas de match exact = CRÉER nouveau produit
        const newId = generateUniqueId(products, row.modelRef, row.color, newProductIds);
        newProductIds.add(newId);
        
        const newProduct: Product = {
          id: newId,
          collection: row.collection || "",
          category: row.category || "",
          subcategory: row.subcategory || "",
          brand: row.brand || "GUESS",
          modelRef: row.modelRef.toUpperCase(),
          gender: row.gender || "",
          supplier: row.supplier || "",
          color: row.color,
          priceRetail: row.priceRetail,
          priceWholesale: row.priceWholesale,
          stockQuantity: row.stockQuantity,
          imageUrl: row.imageUrl || "/images/default.png",
          gallery: [],
          productName: row.productName || row.modelRef,
          size: row.size
        };
        
        creations.push({
          rowNumber: row.rowNumber,
          newProduct
        });
      }
    }
  }

  // Appliquer les modifications
  let backupPath: string | null = null;
  
  if (!dryRun && (operations.length > 0 || creations.length > 0)) {
    backupPath = createBackup(productsPath);
    
    if (!backupPath) {
      throw new Error("שגיאה ביצירת גיבוי - העדכון בוטל למניעת אובדן נתונים");
    }

    // Appliquer les mises à jour
    for (const op of operations) {
      products[op.productIndex].stockQuantity = op.newStock;
    }
    
    // Ajouter les nouveaux produits
    for (const creation of creations) {
      products.push(creation.newProduct);
    }

    try {
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 4), "utf-8");
    } catch (error) {
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, productsPath);
        } catch {
          // Critical error
        }
      }
      throw new Error("שגיאה בשמירת הנתונים - הגיבוי נשמר");
    }
  }

  return {
    success: true,
    dryRun,
    backupPath,
    summary: {
      totalRows: uploadedRows.length,
      validRows: normalizedRows.length,
      toUpdate: operations.length,
      toCreate: creations.length,
      notFound: notFound.length,
      errors: errors.length,
      duplicatesInFile: duplicatesInFile.length
    },
    operations,
    creations,
    notFound,
    errors,
    duplicatesInFile
  };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const dryRunParam = formData.get("dryRun") as string;
    const dryRun = dryRunParam === "true";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "לא נבחר קובץ" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "הקובץ ריק" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "הקובץ גדול מדי (מקסימום 10MB)" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { success: false, error: "פורמט קובץ לא נתמך. השתמש ב-.xlsx, .xls או .csv" },
        { status: 400 }
      );
    }

    let fileContent: ArrayBuffer | string;
    if (isExcel) {
      fileContent = await file.arrayBuffer();
    } else {
      fileContent = await file.text();
    }

    const result = await processUpload(fileContent, isExcel, dryRun);

    const response = {
      success: true,
      dryRun: result.dryRun,
      message: result.dryRun 
        ? `מצב תצוגה מקדימה: ${result.summary.toUpdate} יעודכנו, ${result.summary.toCreate} ייווצרו`
        : `${result.summary.toUpdate} מוצרים עודכנו, ${result.summary.toCreate} מוצרים נוצרו`,
      backupPath: result.backupPath,
      summary: result.summary,
      report: {
        updated: result.operations.map(op => ({
          id: op.productId,
          modelRef: op.modelRef,
          color: op.color,
          size: op.size,
          oldStock: op.oldStock,
          newStock: op.newStock,
          matchType: op.matchType,
          confidence: op.confidence,
          rowNumber: op.rowNumber
        })),
        created: result.creations.map(c => ({
          id: c.newProduct.id,
          modelRef: c.newProduct.modelRef,
          color: c.newProduct.color,
          size: c.newProduct.size,
          stock: c.newProduct.stockQuantity,
          rowNumber: c.rowNumber
        })),
        notFound: result.notFound.map(nf => ({
          row: nf.rowNumber,
          data: {
            reference: nf.modelRef,
            color: nf.color,
            size: nf.size,
            stock: nf.requestedStock
          },
          reason: nf.reason,
          suggestions: nf.suggestions
        })),
        errors: result.errors.map(e => ({
          row: e.rowNumber,
          message: e.message
        })),
        duplicates: result.duplicatesInFile
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "שגיאה לא צפויה",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";

  const headers = ["id", "modelRef", "color", "size", "stockQuantity", "collection", "category", "brand", "priceRetail", "priceWholesale"];
  const exampleRows = [
    ["AA947142", "AA947142", "BLACK MULTI", "", "10", "FALL 2024", "bag", "GUESS", "199.9", "99.95"],
    ["", "NEW_PRODUCT", "BLUE", "M", "5", "SPRING 2025", "shoes", "GUESS", "299.9", "149.95"],
  ];

  if (format === "csv") {
    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.join(","))
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template-stock.csv"',
      },
    });
  } else {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    worksheet["!cols"] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock");

    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template-stock.xlsx"',
      },
    });
  }
}
