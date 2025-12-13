/**
 * Fetch products from Google Sheets
 * Sheet must be public or API key must be configured
 */

interface GoogleSheetRow {
  [key: string]: string | number;
}

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Optional
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Sheet1"; // Default sheet name

/**
 * Fetch data from Google Sheets as CSV (simpler, works with public sheets)
 */
async function fetchSheetAsCSV(): Promise<string> {
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID environment variable is not set");
  }

  // Method 1: CSV export (works if sheet is public)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
  
  try {
    const response = await fetch(csvUrl, {
      next: { revalidate: 0 }, // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Error fetching Google Sheet: ${error instanceof Error ? error.message : String(error)}`);
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
 */
export async function fetchProductsFromGoogleSheet(): Promise<GoogleSheetRow[]> {
  try {
    const csvText = await fetchSheetAsCSV();
    const rows = parseCSV(csvText);
    
    console.log(`[fetchGoogleSheet] Fetched ${rows.length} rows from Google Sheet`);
    
    return rows;
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
  
  // Determine category from subcategory (תיק, נעל, ביגוד)
  // Logic: כפכפים = נעל, rest = ביגוד (based on your sheet structure)
  let category = "ביגוד";
  const subLower = subcategory.toLowerCase();
  if (subLower.includes("כפכפים") || subLower.includes("נעל")) {
    category = "נעל";
  } else if (subLower.includes("תיק")) {
    category = "תיק";
  } else {
    category = "ביגוד";
  }
  
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

