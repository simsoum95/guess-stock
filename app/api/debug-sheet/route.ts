import { NextResponse } from "next/server";
import { fetchProductsFromGoogleSheet, mapSheetRowToProduct } from "@/lib/fetchGoogleSheet";

export const dynamic = 'force-dynamic';

export async function GET() {
  const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  
  const debug: any = {
    timestamp: new Date().toISOString(),
    environment: {
      GOOGLE_SHEET_ID: GOOGLE_SHEET_ID ? `${GOOGLE_SHEET_ID.substring(0, 15)}...` : "NOT SET",
      GOOGLE_API_KEY: GOOGLE_API_KEY ? "SET (hidden)" : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
    steps: [],
    error: null,
    data: null,
  };

  try {
    // Step 1: Check if GOOGLE_SHEET_ID is set
    if (!GOOGLE_SHEET_ID) {
      debug.steps.push("❌ GOOGLE_SHEET_ID is not set!");
      debug.error = "GOOGLE_SHEET_ID environment variable is missing. Add it in Vercel Settings → Environment Variables.";
      return NextResponse.json(debug, { status: 500 });
    }
    debug.steps.push("✅ GOOGLE_SHEET_ID is set");

    // Step 2: Try to fetch sheet names via API (if API key available)
    if (GOOGLE_API_KEY) {
      debug.steps.push("🔄 Trying Google Sheets API v4...");
      
      try {
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${GOOGLE_API_KEY}`;
        const metaResponse = await fetch(metadataUrl, { cache: 'no-store' });
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          const sheetNames = metaData.sheets?.map((s: any) => s.properties.title) || [];
          debug.steps.push(`✅ API returned sheet names: ${sheetNames.join(", ")}`);
          debug.sheetNames = sheetNames;
          
          // Try to fetch first sheet
          if (sheetNames.length > 0) {
            const firstSheet = sheetNames[0];
            const range = encodeURIComponent(firstSheet);
            const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
            const dataResponse = await fetch(dataUrl, { cache: 'no-store' });
            
            if (dataResponse.ok) {
              const data = await dataResponse.json();
              const rows = data.values || [];
              debug.steps.push(`✅ Fetched ${rows.length} rows from "${firstSheet}"`);
              debug.rowCount = rows.length;
              debug.headers = rows[0] || [];
              debug.sampleRows = rows.slice(1, 4); // First 3 data rows
            } else {
              const errText = await dataResponse.text();
              debug.steps.push(`❌ API data fetch failed: ${dataResponse.status} - ${errText.substring(0, 100)}`);
            }
          }
        } else {
          const errText = await metaResponse.text();
          debug.steps.push(`❌ API metadata fetch failed: ${metaResponse.status} - ${errText.substring(0, 200)}`);
          debug.apiError = errText.substring(0, 500);
        }
      } catch (apiError) {
        debug.steps.push(`❌ API error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      }
    } else {
      debug.steps.push("⚠️ GOOGLE_API_KEY not set, trying CSV fallback...");
    }

    // Step 3: Try CSV fallback (limited to ~150 rows)
    debug.steps.push("🔄 Trying CSV export fallback...");
    
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
    const csvResponse = await fetch(csvUrl, { cache: 'no-store' });
    
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      const lines = csvText.split('\n');
      debug.steps.push(`✅ CSV export returned ${lines.length} lines`);
      debug.csvLineCount = lines.length;
      debug.csvFirstLine = lines[0]?.substring(0, 200);
      debug.csvSecondLine = lines[1]?.substring(0, 200);
    } else {
      const errText = await csvResponse.text();
      debug.steps.push(`❌ CSV export failed: ${csvResponse.status}`);
      if (csvResponse.status === 403) {
        debug.steps.push("❌ 403 Forbidden - The Google Sheet is not public!");
        debug.error = "Google Sheet is not accessible. Make it public: Share → 'Anyone with the link' → 'Viewer'";
      }
      debug.csvError = errText.substring(0, 200);
    }

    debug.steps.push("✅ Basic debug complete");
    
    // Step 4: Test the actual fetchProductsFromGoogleSheet function
    debug.steps.push("🔄 Testing fetchProductsFromGoogleSheet()...");
    try {
      const rows = await fetchProductsFromGoogleSheet();
      debug.steps.push(`✅ fetchProductsFromGoogleSheet returned ${rows.length} rows`);
      debug.fetchedRowCount = rows.length;
      
      if (rows.length > 0) {
        debug.steps.push("🔄 Testing mapSheetRowToProduct on first 3 rows...");
        const mappedProducts = rows.slice(0, 3).map((row, idx) => {
          try {
            const product = mapSheetRowToProduct(row, idx);
            return {
              success: true,
              id: product.id,
              modelRef: product.modelRef,
              color: product.color,
              category: product.category,
              subcategory: product.subcategory,
              priceRetail: product.priceRetail,
              stockQuantity: product.stockQuantity,
            };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : String(err),
              rawRow: Object.entries(row).slice(0, 5),
            };
          }
        });
        debug.mappedProducts = mappedProducts;
        debug.steps.push(`✅ Mapped ${mappedProducts.filter(p => p.success).length}/3 products successfully`);
        
        // Show first raw row for debugging
        debug.firstRawRow = Object.fromEntries(Object.entries(rows[0]).slice(0, 10));
      } else {
        debug.steps.push("❌ No rows returned from fetchProductsFromGoogleSheet!");
      }
    } catch (fetchError) {
      debug.steps.push(`❌ fetchProductsFromGoogleSheet error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      debug.fetchError = fetchError instanceof Error ? fetchError.stack : String(fetchError);
    }
    
    debug.steps.push("✅ Full debug complete");
    
  } catch (error) {
    debug.error = error instanceof Error ? error.message : String(error);
    debug.steps.push(`❌ Fatal error: ${debug.error}`);
  }

  return NextResponse.json(debug, { status: debug.error ? 500 : 200 });
}

