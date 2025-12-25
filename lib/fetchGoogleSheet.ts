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
// Default to empty string to trigger auto-discovery
const SHEET_NAMES_STR = process.env.GOOGLE_SHEET_NAME || "";

/**
 * Get list of all sheet names from Google Spreadsheet using API v4
 */
async function getAllSheetNames(): Promise<string[]> {
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID environment variable is not set");
  }

  // Use API v4 to get sheet names if we have API key
  if (GOOGLE_API_KEY) {
    try {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${GOOGLE_API_KEY}`;
      const response = await fetch(apiUrl, { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        const sheetNames = data.sheets?.map((s: any) => s.properties.title) || [];
        if (sheetNames.length > 0) {
          console.log(`[fetchGoogleSheet] Found sheet names via API: ${sheetNames.join(", ")}`);
          return sheetNames;
        }
      }
    } catch (error) {
      console.warn("[fetchGoogleSheet] Error fetching sheet names via API:", error);
    }
  }

  // Fallback: try common names including "final test"
  console.warn("[fetchGoogleSheet] Could not fetch sheet names, trying common names");
  return ["final test", "Sheet1", "ביגוד", "תיקים", "נעליים", "גיליון2", "גיליון1"];
}

/**
 * Get sheet GID (Grid ID) for a sheet name using the API
 */
async function getSheetGID(sheetName: string): Promise<string | null> {
  if (!GOOGLE_SHEET_ID) return null;
  
  try {
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}${GOOGLE_API_KEY ? `?key=${GOOGLE_API_KEY}` : ''}`;
    const response = await fetch(apiUrl, { cache: 'no-store' });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
    return sheet?.properties.sheetId?.toString() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch ALL data from Google Sheets using the v4 API (no row limits)
 * Falls back to CSV if API key is not available
 */
async function fetchSheetData(sheetName: string): Promise<GoogleSheetRow[] | null> {
  if (!GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID environment variable is not set. Please add it to .env.local");
  }

  // Try API v4 first (gets ALL rows, no limits)
  if (GOOGLE_API_KEY) {
    try {
      console.log(`[fetchGoogleSheet] Using Google Sheets API v4 for "${sheetName}"...`);
      
      // Fetch all data using the API (no row limits)
      // Use the sheet name directly in the range
      const range = encodeURIComponent(sheetName);
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
      
      console.log(`[fetchGoogleSheet] API URL: ${apiUrl.replace(GOOGLE_API_KEY, '***')}`);
      
      const response = await fetch(apiUrl, { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length === 0) {
          console.log(`[fetchGoogleSheet] Sheet "${sheetName}" is empty via API`);
          return null;
        }
        
        // First row is headers
        const headers = rows[0].map((h: string) => String(h).trim());
        console.log(`[fetchGoogleSheet] ✅ API SUCCESS: ${rows.length} rows (including header) for "${sheetName}"`);
        console.log(`[fetchGoogleSheet] Headers:`, headers.slice(0, 5).join(", "), "...");
        
        // Convert to GoogleSheetRow format
        const result: GoogleSheetRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row: GoogleSheetRow = {};
          headers.forEach((header: string, index: number) => {
            row[header] = rows[i][index] || "";
          });
          result.push(row);
        }
        
        console.log(`[fetchGoogleSheet] ✅ Converted ${result.length} product rows from API for "${sheetName}"`);
        return result;
      } else {
        const errorText = await response.text();
        console.error(`[fetchGoogleSheet] ❌ API error ${response.status} for "${sheetName}":`, errorText.substring(0, 200));
        
        if (response.status === 404) {
          console.log(`[fetchGoogleSheet] Sheet "${sheetName}" not found via API`);
          return null;
        } else if (response.status === 403) {
          console.warn(`[fetchGoogleSheet] API returned 403 - check API key permissions, falling back to CSV...`);
        } else {
          console.warn(`[fetchGoogleSheet] API returned ${response.status}, falling back to CSV...`);
        }
      }
    } catch (error) {
      console.error(`[fetchGoogleSheet] ❌ API exception for "${sheetName}":`, error instanceof Error ? error.message : error);
      console.warn(`[fetchGoogleSheet] Falling back to CSV export...`);
    }
  } else {
    console.warn(`[fetchGoogleSheet] ⚠️  No GOOGLE_API_KEY configured, using CSV export (LIMITED to ~150 rows)!`);
    console.warn(`[fetchGoogleSheet] To get ALL rows, add GOOGLE_API_KEY to Vercel environment variables.`);
  }

  // Fallback to CSV (limited to ~150 rows)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;
    const response = await fetch(csvUrl, { cache: 'no-store' });

    if (!response.ok) {
      if (response.status === 404) return null;
      if (response.status === 403) {
        throw new Error(`Google Sheet is not accessible. Make it public: Share → "Anyone with the link" → "Viewer"`);
      }
      return null;
    }

    const text = await response.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
      return null;
    }

    const lineCount = text.split('\n').length;
    console.log(`[fetchGoogleSheet] CSV export for "${sheetName}": ${lineCount} lines (LIMITED - get GOOGLE_API_KEY for all rows)`);
    
    // Parse CSV
    const rows = parseCSV(text);
    return rows;
  } catch (error) {
    console.warn(`[fetchGoogleSheet] CSV error for "${sheetName}":`, error instanceof Error ? error.message : error);
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
    }

    // If no sheet names specified, discover them automatically
    if (sheetNames.length === 0) {
      console.log("[fetchGoogleSheet] No sheet names specified, discovering automatically...");
      const discoveredNames = await getAllSheetNames();
      if (discoveredNames.length > 0) {
        sheetNames = discoveredNames;
        console.log(`[fetchGoogleSheet] ✅ Discovered sheet names: ${sheetNames.join(", ")}`);
      } else {
        // Fallback to common Hebrew names
        sheetNames = ["ביגוד", "תיקים", "נעליים"];
        console.log("[fetchGoogleSheet] Using fallback Hebrew sheet names");
      }
    }
    
    // Remove duplicates from sheet names list
    sheetNames = [...new Set(sheetNames)];

    console.log(`[fetchGoogleSheet] Reading sheets: ${sheetNames.join(", ")}`);

    // Fetch from all sheets and combine results
    const allRows: GoogleSheetRow[] = [];
    
    for (const sheetName of sheetNames) {
      try {
        console.log(`[fetchGoogleSheet] ===== FETCHING SHEET: "${sheetName}" =====`);
        
        // Use new API method that gets ALL rows (no 150 row limit)
        const rows = await fetchSheetData(sheetName);
        
        if (!rows) {
          console.error(`[fetchGoogleSheet] ❌ Sheet "${sheetName}" returned null`);
          continue;
        }
        
        if (rows.length === 0) {
          console.error(`[fetchGoogleSheet] ❌ Sheet "${sheetName}" returned empty array`);
          continue;
        }

        console.log(`[fetchGoogleSheet] ✅ Got ${rows.length} total rows from sheet "${sheetName}"`);
        
        if (rows.length > 0) {
          // Log first row to see structure
          if (rows.length > 0) {
            console.log(`[fetchGoogleSheet] First row keys:`, Object.keys(rows[0]));
            console.log(`[fetchGoogleSheet] First row sample (first 3 cols):`, Object.entries(rows[0]).slice(0, 3));
          }
          
          // Filter out header row and completely empty rows
          // Header row usually has column names like "קולקציה", "תת משפחה", etc.
          const validRows = rows.filter((row, idx) => {
            // Skip if it looks like a header row (has common Hebrew column names in first column)
            const firstValue = Object.values(row)[0]?.toString().toLowerCase() || "";
            const secondValue = Object.values(row)[1]?.toString().toLowerCase() || "";
            
            // More lenient header detection - only skip if BOTH first and second columns match header patterns
            if ((firstValue.includes("קולקציה") || firstValue.includes("תת משפחה") || firstValue.includes("מותג")) &&
                (secondValue.includes("תת משפחה") || secondValue.includes("מותג") || secondValue.includes("קוד"))) {
              if (idx === 0) {
                console.log(`[fetchGoogleSheet] Skipping header row at index ${idx}`);
              }
              return false;
            }
            
            // Check if row has ANY data at all
            const hasData = Object.values(row).some(val => {
              const str = String(val || "").trim();
              return str.length > 0;
            });
            
            if (!hasData) {
              return false; // Skip completely empty rows
            }
            
            // Check for modelRef - Column D: "קוד גם" (base product code)
            // Also check for itemCode - Column G: "קוד פריט" (specific item code)
            const modelRef = (
              row["קוד גם"] || 
              row["מגז-קוד גם"] || 
              row["קוד דגם"] || 
              row["modelRef"] || 
              ""
            ).toString().trim();
            
            const itemCode = (
              row["קוד פריט"] || 
              row["itemCode"] || 
              ""
            ).toString().trim();
            
            // Accept row if it has EITHER modelRef OR itemCode (both exist in your sheet!)
            const hasIdentifier = modelRef.length > 0 || itemCode.length > 0;
            const hasModelRef = modelRef.length > 0;
            
            if (hasData && !hasIdentifier) {
              if (idx < 10) {
                console.warn(`[fetchGoogleSheet] Row ${idx} has data but no modelRef or itemCode. Keys:`, Object.keys(row).slice(0, 5));
              }
            }
            
            // DEBUG MODE: Accept ALL rows with data (temporarily to see what we get)
            // Normally: return hasData && hasIdentifier;
            // But for debugging, accept everything with data
            if (hasData && !hasIdentifier) {
              if (idx < 5) {
                console.warn(`[fetchGoogleSheet] DEBUG: Row ${idx} has data but no modelRef/itemCode. Keeping it anyway for debugging.`);
                console.warn(`[fetchGoogleSheet] Row ${idx} keys:`, Object.keys(row));
              }
            }
            return hasData; // Accept ALL rows with data for now
          });
          
        console.log(`[fetchGoogleSheet] After filtering: ${validRows.length} valid product rows from "${sheetName}" (filtered out ${rows.length - validRows.length} rows)`);
        
        if (validRows.length === 0 && rows.length > 1) {
          console.error(`[fetchGoogleSheet] ❌❌❌ CRITICAL: No valid rows found in "${sheetName}" despite ${rows.length} parsed rows! ❌❌❌`);
          console.error(`[fetchGoogleSheet] ===== DEBUG INFO START =====`);
          console.error(`[fetchGoogleSheet] First row (index 0) ALL data:`, JSON.stringify(rows[0], null, 2));
          console.error(`[fetchGoogleSheet] First row keys:`, Object.keys(rows[0] || {}));
          
          // Test filtering on first few rows manually
          const testRows = rows.slice(0, 5);
          testRows.forEach((row, idx) => {
            const firstValue = String(Object.values(row)[0] || "").toLowerCase();
            const hasData = Object.values(row).some(val => {
              const str = String(val || "").trim();
              return str.length > 0;
            });
            const modelRef = (row["קוד גם"] || row["מגז-קוד גם"] || row["קוד דגם"] || "").toString().trim();
            const itemCode = (row["קוד פריט"] || "").toString().trim();
            console.error(`[fetchGoogleSheet] Test row ${idx}: firstValue="${firstValue}", hasData=${hasData}, modelRef="${modelRef}", itemCode="${itemCode}"`);
            console.error(`[fetchGoogleSheet] Test row ${idx} all values:`, Object.entries(row).map(([k, v]) => `${k}="${String(v).substring(0, 30)}"`).join(", "));
          });
          console.error(`[fetchGoogleSheet] ===== DEBUG INFO END =====`);
        }
        
        if (validRows.length > 0) {
          console.log(`[fetchGoogleSheet] ✅ Adding ${validRows.length} valid rows from "${sheetName}"`);
          allRows.push(...validRows);
        } else {
          console.error(`[fetchGoogleSheet] ❌ Skipping "${sheetName}" - no valid rows`);
        }
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
        modelRef: row["מגז-קוד גם"] || row["קוד גם"] || row["קוד דגם"] || row["modelRef"] || "",
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
      const modelRef = (row["מגז-קוד גם"] || row["קוד גם"] || row["קוד דגם"] || row["modelRef"] || "").toString().trim();
      const color = (row["צבע"] || row["color"] || "").toString().trim();
      const itemCode = (row["קוד פריט"] || row["itemCode"] || row["ItemCode"] || "").toString().trim();
      const size = (row["מידה"] || row["size"] || row["Size"] || "").toString().trim();
      
      // Skip rows that are completely empty (no modelRef)
      // NOTE: "קוד פריט" doesn't exist in your Google Sheet, so we only check modelRef
      if (!modelRef) {
        skippedRows.push({ index: index + 1, reason: "No modelRef", row: { modelRef, color } });
        return;
      }
      
      // CRITICAL: Always include row index in key to ensure ALL rows are kept as unique products
      // Even if two rows have same modelRef+color, they are different products (different rows)
      // Your Google Sheet doesn't have "קוד פריט", so each row = one unique product
      let key: string;
      if (itemCode) {
        // If itemCode exists (unlikely), use it but still add row index for safety
        key = `${itemCode}|ROW${index}`.toUpperCase().trim();
      } else if (modelRef && color) {
        // Use modelRef + color + row index - ALWAYS include row index to keep all products
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
  colorCode: string; // Color abbreviation from itemCode for image matching
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
  // Column D: קוד גם = modelRef (base product code)
  const modelRef = getValue(["קוד גם", "מגז-קוד גם", "קוד דגם", "מק״ט", "modelRef", "ModelRef", "MODELREF"]);
  // Column G: קוד פריט = itemCode (specific item code with color)
  const itemCode = getValue(["קוד פריט", "itemCode", "ItemCode"]);
  // Column H: צבע = color
  const color = getValue(["צבע", "color", "Color", "COLOR"]);
  // Column B: תת משפחה = subcategory
  const subcategory = getValue(["תת משפחה", "תת קטגוריה", "subcategory", "Subcategory", "SUBCATEGORY"]);
  
  // Map subcategory to main category based on product type
  // תיקים (Bags) category:
  const bagSubcategories = [
    "ארנקים", "ארנק", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות", "תיק יד", "תיק כתף", "תיק עסקים"
  ];
  
  // נעליים (Shoes) category:
  const shoesSubcategories = [
    "כפכפים", "סניקרס", "נעליים שטוחו", "נעלי עקב", "מגפיים"
  ];
  
  // ביגוד (Clothes) category:
  const clothesSubcategories = [
    "טישירט", "סווטשירט", "צעיפים", "ג׳ינסים", "ג׳קטים ומעיל"
  ];
  
  // Determine category based on subcategory
  let category = "ביגוד"; // Default
  
  if (bagSubcategories.some(sub => subcategory.includes(sub))) {
    category = "תיק";
  } else if (shoesSubcategories.some(sub => subcategory.includes(sub))) {
    category = "נעל";
  } else if (clothesSubcategories.some(sub => subcategory.includes(sub))) {
    category = "ביגוד";
  }
  // else: stays as "ביגוד" (already set as default)
  
  // Use itemCode if available, otherwise use modelRef for the ID
  const uniqueId = itemCode || `${modelRef}-${color}-${index}`;
  
  // Extract color code from itemCode (e.g., "PD760221-BLO-OS" -> "BLO")
  // This is more reliable for image matching than the full color name
  let colorCode = "";
  if (itemCode) {
    const parts = itemCode.split("-");
    if (parts.length >= 2) {
      // The color code is usually the second part (after modelRef)
      colorCode = parts[1].toUpperCase();
    }
  }
  
  return {
    id: uniqueId,
    collection: getValue(["קולקציה", "collection", "Collection", "COLLECTION"]),
    category: category || "תיק",
    subcategory: subcategory,
    brand: getValue(["מותג", "brand", "Brand", "BRAND"]),
    modelRef: modelRef,
    gender: getValue(["מגדר", "gender", "Gender", "GENDER"]),
    supplier: getValue(["ספק", "supplier", "Supplier", "SUPPLIER"]),
    color: color,
    colorCode: colorCode, // Abbreviation from itemCode for image matching
    // מחיר כולל מע"מ בסיס = priceRetail (column I in תיקים sheet)
    priceRetail: getNumber(["מחיר כולל מע\"מ בסיס", "מחיר כולל מע\"מ בסיכ", "מחיר קמעונאי", "קמעונאי", "priceRetail", "PriceRetail"]),
    // סיטונאי = priceWholesale (column J)
    priceWholesale: getNumber(["סיטונאי", "מחיר סיטונאי", "priceWholesale", "PriceWholesale"]),
    // כמות מלאי נוכחי = stockQuantity (column K)
    stockQuantity: getNumber(["כמות מלאי נוכחי", "כמות מלאי נוכו", "מלאי", "כמות", "stockQuantity", "StockQuantity"]),
    productName: getValue(["שם מוצר", "שם", "productName", "ProductName"]) || itemCode || modelRef,
    size: getValue(["מידה", "size", "Size", "SIZE"]),
  };
}

