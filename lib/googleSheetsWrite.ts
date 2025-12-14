/**
 * Google Sheets Write Operations
 * Requires a Service Account with write access to the Google Sheet
 * 
 * Environment variables needed:
 * - GOOGLE_SHEET_ID: The ID of the Google Sheet
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: The email of the Service Account
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: The private key of the Service Account (from JSON)
 */

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

interface ProductData {
  collection?: string;
  subcategory?: string;
  brand?: string;
  modelRef: string;
  gender?: string;
  supplier?: string;
  color: string;
  priceRetail?: number;
  stockQuantity?: number;
  priceWholesale?: number;
}

/**
 * Generate a JWT token for Google API authentication
 */
async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error("Google Service Account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in environment variables.");
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Encode header and claim
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const signatureInput = `${base64Header}.${base64Claim}`;

  // Sign with private key
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(SERVICE_ACCOUNT_PRIVATE_KEY, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Get all sheet names from the spreadsheet
 */
async function getSheetNames(): Promise<string[]> {
  const accessToken = await getAccessToken();
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get sheet names: ${response.statusText}`);
  }

  const data = await response.json();
  return data.sheets?.map((s: any) => s.properties.title) || [];
}

/**
 * Determine which sheet to add the product to based on subcategory
 */
function getTargetSheet(subcategory: string): string {
  const bagSubcategories = [
    "ארנקים", "ארנק", "תיק צד", "תיק נשיאה", "מזוודות", "תיק גב", "תיק נסיעות", 
    "תיק ערב", "מחזיק מפתחות", "קלאץ", "תיק יד", "תיק"
  ];
  
  const shoesSubcategories = [
    "כפכפים", "סניקרס", "נעליים שטוחו", "נעלי עקב", "סנדלים", "מגפיים", "נעליים"
  ];

  if (bagSubcategories.some(sub => subcategory.includes(sub))) {
    return "תיקים";
  } else if (shoesSubcategories.some(sub => subcategory.includes(sub))) {
    return "נעליים";
  }
  return "ביגוד";
}

/**
 * Format price for Google Sheets (Israeli format)
 */
function formatPrice(price: number | undefined): string {
  if (!price) return "";
  return ` ₪  ${price.toFixed(2).replace('.', ',')} `;
}

/**
 * Read the headers from a sheet to determine column order
 */
async function getSheetHeaders(accessToken: string, sheetName: string): Promise<string[]> {
  const range = encodeURIComponent(`${sheetName}!1:1`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to read headers from ${sheetName}`);
  }

  const data = await response.json();
  const headers = data.values?.[0] || [];
  console.log(`[googleSheetsWrite] Headers for "${sheetName}":`, headers);
  return headers.map((h: string) => h.trim());
}

/**
 * Build row data based on actual column headers in the sheet
 */
function buildRowData(headers: string[], product: ProductData): string[] {
  // Generate item code from modelRef + color abbreviation
  const colorAbbrev = product.color.substring(0, 3).toUpperCase();
  const itemCode = `${product.modelRef}-${colorAbbrev}-OS`;

  // Map column names to values (supporting multiple possible names for each field)
  const columnMappings: { [key: string]: string } = {
    // Collection
    "קולקציה": product.collection || "",
    // Subcategory
    "תת משפחה": product.subcategory || "",
    // Brand
    "מותג": product.brand || "GUESS",
    // Model Reference
    "קוד גם": product.modelRef,
    // Gender
    "מגדר": product.gender || "",
    // Supplier
    "ספק": product.supplier || "",
    // Item Code
    "קוד פריט": itemCode,
    // Color
    "צבע": product.color,
    // Retail Price (with ₪ symbol)
    "מחיר כולל מע\"מ בסיס": formatPrice(product.priceRetail),
    " מחיר כולל מע\"מ בסיס ": formatPrice(product.priceRetail), // with spaces
    "מחיר כולל מע\"מ בסיכ": formatPrice(product.priceRetail), // typo variant
    // Stock Quantity (plain number)
    "כמות מלאי נוכחי": product.stockQuantity?.toString() || "0",
    " כמות מלאי נוכחי ": product.stockQuantity?.toString() || "0", // with spaces
    "כמות מלאי נוכו": product.stockQuantity?.toString() || "0", // typo variant
    // Wholesale Price
    "סיטונאי": formatPrice(product.priceWholesale),
    " סיטונאי ": formatPrice(product.priceWholesale), // with spaces
    " סיטונאי  ": formatPrice(product.priceWholesale), // with more spaces
  };

  // Build row data in the order of the actual headers
  const rowData: string[] = [];
  for (const header of headers) {
    const trimmedHeader = header.trim();
    // Try to find matching value, use empty string if not found
    let value = "";
    for (const [key, val] of Object.entries(columnMappings)) {
      if (trimmedHeader.includes(key.trim()) || key.trim().includes(trimmedHeader)) {
        value = val;
        break;
      }
    }
    rowData.push(value);
  }

  console.log(`[googleSheetsWrite] Built row data for ${headers.length} columns:`, rowData);
  return rowData;
}

/**
 * Add a new product to Google Sheets
 */
export async function addProductToSheet(product: ProductData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID not configured");
    }

    const accessToken = await getAccessToken();
    const targetSheet = product.subcategory ? getTargetSheet(product.subcategory) : "ביגוד";
    
    // STEP 1: Read the headers from the target sheet to know the column order
    console.log(`[googleSheetsWrite] Reading headers from "${targetSheet}"...`);
    const headers = await getSheetHeaders(accessToken, targetSheet);
    
    if (headers.length === 0) {
      throw new Error(`Sheet "${targetSheet}" has no headers`);
    }

    // STEP 2: Build row data based on actual column order
    const rowData = buildRowData(headers, product);

    // STEP 3: Append row to sheet
    const lastColumn = String.fromCharCode(64 + headers.length); // A=65, so 64+1=A, 64+11=K
    const range = encodeURIComponent(`${targetSheet}!A:${lastColumn}`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add product: ${error}`);
    }

    console.log(`[googleSheetsWrite] Added product ${product.modelRef} to sheet "${targetSheet}"`);
    return { success: true };
  } catch (error) {
    console.error("[googleSheetsWrite] Error adding product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Find a product row by modelRef and color
 * Columns: A: קולקציה, B: תת משפחה, C: מותג, D: קוד גם, E: מגדר, F: ספק, 
 *          G: קוד פריט, H: צבע, I: מחיר, J: כמות מלאי, K: סיטונאי
 */
async function findProductRow(sheetName: string, modelRef: string, color: string): Promise<number | null> {
  const accessToken = await getAccessToken();
  
  // Fetch columns A to H to get modelRef (D=3) and color (H=7)
  const range = encodeURIComponent(`${sheetName}!A:H`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const rows = data.values || [];

  for (let i = 1; i < rows.length; i++) { // Skip header row
    const row = rows[i];
    const rowModelRef = (row[3] || "").toString().trim(); // Column D (index 3) = קוד גם
    const rowColor = (row[7] || "").toString().trim();    // Column H (index 7) = צבע
    
    if (rowModelRef.toUpperCase() === modelRef.toUpperCase() && 
        rowColor.toUpperCase() === color.toUpperCase()) {
      return i + 1; // Google Sheets rows are 1-indexed
    }
  }

  return null;
}

/**
 * Update an existing product in Google Sheets
 */
export async function updateProductInSheet(
  modelRef: string, 
  color: string, 
  updates: Partial<ProductData>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID not configured");
    }

    const accessToken = await getAccessToken();
    const sheetNames = await getSheetNames();
    
    // Search for the product in all sheets
    let foundSheet: string | null = null;
    let rowNumber: number | null = null;

    for (const sheetName of sheetNames) {
      const row = await findProductRow(sheetName, modelRef, color);
      if (row !== null) {
        foundSheet = sheetName;
        rowNumber = row;
        break;
      }
    }

    if (!foundSheet || rowNumber === null) {
      return { success: false, error: `Product ${modelRef} (${color}) not found` };
    }

    // Build update data - only update specified fields
    // Columns: A: קולקציה, B: תת משפחה, C: מותג, D: קוד גם, E: מגדר, F: ספק, 
    //          G: קוד פריט, H: צבע, I: מחיר, J: כמות מלאי, K: סיטונאי
    const updateValues: { range: string; values: string[][] }[] = [];
    
    if (updates.collection !== undefined) {
      updateValues.push({ range: `${foundSheet}!A${rowNumber}`, values: [[updates.collection]] });
    }
    if (updates.subcategory !== undefined) {
      updateValues.push({ range: `${foundSheet}!B${rowNumber}`, values: [[updates.subcategory]] });
    }
    if (updates.brand !== undefined) {
      updateValues.push({ range: `${foundSheet}!C${rowNumber}`, values: [[updates.brand]] });
    }
    if (updates.gender !== undefined) {
      updateValues.push({ range: `${foundSheet}!E${rowNumber}`, values: [[updates.gender]] });
    }
    if (updates.supplier !== undefined) {
      updateValues.push({ range: `${foundSheet}!F${rowNumber}`, values: [[updates.supplier]] });
    }
    if (updates.color !== undefined) {
      updateValues.push({ range: `${foundSheet}!H${rowNumber}`, values: [[updates.color]] }); // H = צבע
    }
    if (updates.priceRetail !== undefined) {
      updateValues.push({ range: `${foundSheet}!I${rowNumber}`, values: [[formatPrice(updates.priceRetail)]] }); // I = מחיר
    }
    if (updates.stockQuantity !== undefined) {
      updateValues.push({ range: `${foundSheet}!J${rowNumber}`, values: [[updates.stockQuantity.toString()]] }); // J = כמות מלאי
    }
    if (updates.priceWholesale !== undefined) {
      updateValues.push({ range: `${foundSheet}!K${rowNumber}`, values: [[formatPrice(updates.priceWholesale)]] }); // K = סיטונאי
    }

    if (updateValues.length === 0) {
      return { success: true }; // Nothing to update
    }

    // Batch update
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: updateValues
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update product: ${error}`);
    }

    console.log(`[googleSheetsWrite] Updated product ${modelRef} (${color}) in sheet "${foundSheet}"`);
    return { success: true };
  } catch (error) {
    console.error("[googleSheetsWrite] Error updating product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Delete a product from Google Sheets
 */
export async function deleteProductFromSheet(
  modelRef: string, 
  color: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID not configured");
    }

    const accessToken = await getAccessToken();
    const sheetNames = await getSheetNames();
    
    // Search for the product in all sheets
    let foundSheet: string | null = null;
    let rowNumber: number | null = null;
    let sheetId: number | null = null;

    // Get sheet IDs
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    const metaData = await metaResponse.json();
    const sheetsInfo = metaData.sheets || [];

    for (const sheetInfo of sheetsInfo) {
      const sheetName = sheetInfo.properties.title;
      const row = await findProductRow(sheetName, modelRef, color);
      if (row !== null) {
        foundSheet = sheetName;
        rowNumber = row;
        sheetId = sheetInfo.properties.sheetId;
        break;
      }
    }

    if (!foundSheet || rowNumber === null || sheetId === null) {
      return { success: false, error: `Product ${modelRef} (${color}) not found` };
    }

    // Delete the row using batchUpdate with deleteDimension
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowNumber - 1, // 0-indexed
                endIndex: rowNumber // exclusive
              }
            }
          }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete product: ${error}`);
    }

    console.log(`[googleSheetsWrite] Deleted product ${modelRef} (${color}) from sheet "${foundSheet}"`);
    return { success: true };
  } catch (error) {
    console.error("[googleSheetsWrite] Error deleting product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Check if Google Sheets write is configured
 */
export function isWriteConfigured(): boolean {
  return !!(GOOGLE_SHEET_ID && SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_PRIVATE_KEY);
}

