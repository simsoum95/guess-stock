/**
 * Fetch products from Google Sheets
 * Sheet must be public or API key must be configured
 */

interface GoogleSheetRow {
  [key: string]: string | number;
}

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Optional
// Support multiple sheet names: comma-separated list, or "all" to fetch all sheets
const SHEET_NAMES_STR = process.env.GOOGLE_SHEET_NAME || "Sheet1";

/**
 * Get list of all sheet names from Google Spreadsheet
 */
async function getAllSheetNames(): Promise<string[]> {
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID environment variable is not set");
  }

  // Use the Google Sheets API endpoint to get sheet metadata
  // This works without authentication if the sheet is public
  const metadataUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
  
  try {
    const response = await fetch(metadataUrl, {
      next: { revalidate: 0 },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn("[fetchGoogleSheet] Could not fetch sheet names, will try default names");
      return ["Sheet1", "Sheet2", "Sheet3"]; // Fallback to common names
    }

    const text = await response.text();
    // Remove the prefix "google.visualization.Query.setResponse(" and suffix ");"
    const jsonText = text.replace(/^.*?\(/, '').replace(/\);?\s*$/, '');
    const data = JSON.parse(jsonText);
    
    if (data.table && data.table.cols) {
      // This doesn't give us sheet names directly, so we'll use the fallback
      return ["Sheet1", "Sheet2", "Sheet3"];
    }
    
    return ["Sheet1", "Sheet2", "Sheet3"]; // Fallback
  } catch (error) {
    console.warn("[fetchGoogleSheet] Error fetching sheet names:", error);
    return ["Sheet1", "Sheet2", "Sheet3"]; // Fallback to common names
  }
}

/**
 * Fetch data from Google Sheets as CSV for a specific sheet
 */
async function fetchSheetAsCSV(sheetName: string): Promise<string | null> {
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID environment variable is not set. Please add it to .env.local");
  }

  // Method 1: CSV export (works if sheet is public)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  
  try {
          const response = await fetch(csvUrl, {
            cache: 'no-store', // Don't cache on server
          });

    if (!response.ok) {
      if (response.status === 404) {
        // Sheet doesn't exist, return null
        return null;
      }
      if (response.status === 403) {
        throw new Error(
          `Google Sheet is not accessible (${response.status}). ` +
          `Please make sure the Sheet is public: Share → "Anyone with the link" → "Viewer"`
        );
      }
      return null; // Skip this sheet if error
    }

    const text = await response.text();
    
    // Check if response is HTML error page instead of CSV
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
      return null; // Skip this sheet
    }

    return text;
  } catch (error) {
    // Return null if this sheet doesn't exist or fails
    return null;
  }
}

/**
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): GoogleSheetRow[] {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows: GoogleSheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: GoogleSheetRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Fetch products from Google Sheets and parse them
 * Reads from all specified sheets or tries to discover all sheets
 */
export async function fetchProductsFromGoogleSheet(): Promise<GoogleSheetRow[]> {
  try {
    // Determine which sheets to read
    let sheetNames: string[] = [];
    
    if (SHEET_NAMES_STR.toLowerCase() === "all") {
      // Try to get all sheet names
      console.log("[fetchGoogleSheet] Fetching all sheets...");
      sheetNames = await getAllSheetNames();
    } else {
      // Use specified sheet names (comma-separated)
      sheetNames = SHEET_NAMES_STR.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (sheetNames.length === 0) {
        sheetNames = ["Sheet1"]; // Default
      }
    }

    // Only try common sheet names if no sheets were specified at all
    // DO NOT auto-add sheets if user specified even one sheet name
    if (sheetNames.length === 0) {
      // Only if completely empty, try the default Sheet1
      sheetNames = ["Sheet1"];
      console.log("[fetchGoogleSheet] No sheet names specified, using default: Sheet1");
    }
    
    // Remove duplicates from sheet names list
    sheetNames = [...new Set(sheetNames)];

    console.log(`[fetchGoogleSheet] Reading sheets: ${sheetNames.join(", ")}`);

    // Fetch from all sheets and combine results
    const allRows: GoogleSheetRow[] = [];
    
    for (const sheetName of sheetNames) {
      try {
        const csvText = await fetchSheetAsCSV(sheetName);
        if (!csvText) {
          console.log(`[fetchGoogleSheet] Sheet "${sheetName}" not found or empty, skipping...`);
          continue;
        }

        const rows = parseCSV(csvText);
        if (rows.length > 0) {
          console.log(`[fetchGoogleSheet] Fetched ${rows.length} rows from sheet "${sheetName}"`);
          // Filter out completely empty rows (all values are empty strings)
          const validRows = rows.filter(row => {
            const hasData = Object.values(row).some(val => {
              const str = String(val || "").trim();
              return str.length > 0;
            });
            return hasData;
          });
          console.log(`[fetchGoogleSheet] After filtering empty rows: ${validRows.length} valid rows from "${sheetName}"`);
          allRows.push(...validRows);
        }
      } catch (error) {
        console.warn(`[fetchGoogleSheet] Error reading sheet "${sheetName}":`, error instanceof Error ? error.message : error);
        // Continue with other sheets
      }
    }
    
    console.log(`[fetchGoogleSheet] Total: ${allRows.length} rows from ${sheetNames.length} sheet(s)`);
    
    // Debug: Show sample of rows before deduplication
    if (allRows.length > 0 && allRows.length <= 50) {
      console.log(`[fetchGoogleSheet] Sample rows (first 5):`, allRows.slice(0, 5).map((row, idx) => ({
        index: idx + 1,
        subcategory: row["תת משפחה"] || row["תת קטגוריה"] || row["subcategory"] || "",
        modelRef: row["קוד גם"] || row["קוד דגם"] || row["modelRef"] || "",
        color: row["צבע"] || row["color"] || "",
        itemCode: row["קוד פריט"] || row["itemCode"] || "",
      })));
    }
    
    // Debug: Count rows by subcategory before deduplication
    const subcategoryCount = new Map<string, number>();
    allRows.forEach(row => {
      const subcat = (row["תת משפחה"] || row["תת קטגוריה"] || row["subcategory"] || "unknown").toString().trim();
      subcategoryCount.set(subcat, (subcategoryCount.get(subcat) || 0) + 1);
    });
    console.log(`[fetchGoogleSheet] Rows by subcategory before deduplication:`);
    Array.from(subcategoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([subcat, count]) => {
        console.log(`  - "${subcat}": ${count} rows`);
      });
    
    // Remove duplicates based on modelRef + color + item code combination
    // Use "קוד פריט" (item code) if available to differentiate products with same modelRef+color
    const uniqueRows = new Map<string, GoogleSheetRow>();
    const duplicateCount = new Map<string, number>();
    
    const skippedRows: Array<{index: number; reason: string; row: any}> = [];
    
    allRows.forEach((row, index) => {
      const modelRef = (row["קוד גם"] || row["קוד דגם"] || row["modelRef"] || "").toString().trim();
      const color = (row["צבע"] || row["color"] || "").toString().trim();
      const itemCode = (row["קוד פריט"] || row["itemCode"] || row["ItemCode"] || "").toString().trim();
      const size = (row["מידה"] || row["size"] || row["Size"] || "").toString().trim();
      
      // Skip rows that are completely empty (no modelRef, no itemCode)
      if (!modelRef && !itemCode) {
        skippedRows.push({ index: index + 1, reason: "No modelRef or itemCode", row: { modelRef, color, itemCode } });
        return;
      }
      
      // Create key: use itemCode first (most unique), then row index as fallback
      // Since קוד פריט should be unique per product, use it directly as the key
      let key: string;
      if (itemCode) {
        // Use itemCode directly as key - it should be unique per product variant
        // Example: "BG1001-BL" should be unique
        key = itemCode.toUpperCase().trim();
      } else if (modelRef && color) {
        // Fallback: use modelRef + color + row index to ensure uniqueness
        // This prevents removing products that legitimately have same modelRef+color
        if (size) {
          key = `${modelRef}|${color}|${size}|ROW${index}`.toUpperCase();
        } else {
          key = `${modelRef}|${color}|ROW${index}`.toUpperCase();
        }
      } else if (modelRef) {
        // Only modelRef, use row index
        key = `${modelRef}|ROW${index}`.toUpperCase();
      } else {
        // Last resort: just row index to ensure all rows are kept
        key = `ROW${index}`.toUpperCase();
      }
      
      if (!uniqueRows.has(key)) {
        uniqueRows.set(key, row);
      } else {
        // Count duplicates for debugging
        const count = duplicateCount.get(key) || 0;
        duplicateCount.set(key, count + 1);
        skippedRows.push({ 
          index: index + 1, 
          reason: `Duplicate key: ${key}`, 
          row: { modelRef, color, itemCode, key } 
        });
        console.warn(`[fetchGoogleSheet] Duplicate found (row ${index + 1}): ${key} - keeping first occurrence`);
      }
    });

    console.log(`[fetchGoogleSheet] After deduplication: ${uniqueRows.size} unique products (from ${allRows.length} total rows)`);
    if (duplicateCount.size > 0) {
      const totalDuplicates = Array.from(duplicateCount.values()).reduce((a, b) => a + b, 0);
      console.log(`[fetchGoogleSheet] Removed ${totalDuplicates} duplicate rows`);
    }
    if (skippedRows.length > 0) {
      console.log(`[fetchGoogleSheet] Skipped ${skippedRows.length} rows:`, skippedRows.slice(0, 10));
      if (skippedRows.length > 10) {
        console.log(`[fetchGoogleSheet] ... and ${skippedRows.length - 10} more skipped rows`);
      }
    }
    
    return Array.from(uniqueRows.values());
  } catch (error) {
    console.error("[fetchGoogleSheet] Error:", error);
    throw error;
  }
}

/**
 * Map Google Sheet row to Product data structure
 * Adjust column names based on your actual Google Sheet columns
 */
export function mapSheetRowToProduct(row: GoogleSheetRow, index: number): {
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
  productName?: string;
  size?: string;
} {
  // Helper to get value from row (check multiple possible column names)
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
      if (value !== undefined && value !== null && value !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    if (!value) return 0;
    // Remove currency symbols (₪), all spaces, handle comma as decimal separator
    // Example: "₪ 1 149,90" -> "1149.90"
    const cleaned = value
      .replace(/₪/g, "")
      .replace(/\s+/g, "")  // Remove all spaces (including thousands separator)
      .replace(/,/g, ".");   // Replace comma with dot for decimal
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Map according to your Google Sheet columns (Hebrew names from the sheet)
  // Column D: קוד גם = modelRef
  const modelRef = getValue(["קוד גם", "קוד דגם", "מק״ט", "modelRef", "ModelRef", "MODELREF"]);
  // Column G: צבע = color
  const color = getValue(["צבע", "color", "Color", "COLOR"]);
  // Column B: תת משפחה = subcategory
  const subcategory = getValue(["תת משפחה", "תת קטגוריה", "subcategory", "Subcategory", "SUBCATEGORY"]);
  
  // Map subcategory to main category based on product type
  // תיקים (Bags) category:
  const bagSubcategories = [
    "ארנקים", "ארנק", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות", "קלאץ"
  ];
  
  // נעליים (Shoes) category:
  const shoesSubcategories = [
    "כפכפים", "סניקרס", "נעליים שטוחו", "נעלי עקב", "סנדלים", "מגפיים"
  ];
  
  // ביגוד (Clothes) category: everything else
  let category = "ביגוד"; // Default
  
  if (bagSubcategories.some(sub => subcategory.includes(sub))) {
    category = "תיק";
  } else if (shoesSubcategories.some(sub => subcategory.includes(sub))) {
    category = "נעל";
  }
  // else: stays as "ביגוד" (already set as default)
  
  return {
    id: `${modelRef}-${color}-${index}`,
    collection: getValue(["קולקציה", "collection", "Collection", "COLLECTION"]),
    category: category || "תיק",
    subcategory: subcategory,
    brand: getValue(["מותג", "brand", "Brand", "BRAND"]),
    modelRef: modelRef,
    gender: getValue(["מגדר", "gender", "Gender", "GENDER"]),
    supplier: getValue(["ספק", "supplier", "Supplier", "SUPPLIER"]),
    color: color,
    // מחיר כולל מע"מ בסיס = priceRetail (column H)
    priceRetail: getNumber(["מחיר כולל מע\"מ בסיס", "מחיר קמעונאי", "קמעונאי", "priceRetail", "PriceRetail"]),
    // סיטונאי = priceWholesale (column J)
    priceWholesale: getNumber(["סיטונאי", "מחיר סיטונאי", "priceWholesale", "PriceWholesale"]),
    // כמות מלאי נוכחי = stockQuantity (column I)
    stockQuantity: getNumber(["כמות מלאי נוכחי", "מלאי", "כמות", "stockQuantity", "StockQuantity"]),
    productName: getValue(["שם מוצר", "שם", "productName", "ProductName"]) || modelRef,
    size: getValue(["מידה", "size", "Size", "SIZE"]),
  };
}

