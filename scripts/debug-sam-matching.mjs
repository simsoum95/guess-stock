import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Get SAM EDELMAN products from the sheet
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const samUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("נעליים SAM")}?key=${apiKey}`;
  const samRes = await fetch(samUrl);
  const samData = await samRes.json();
  
  const headers = samData.values[0].map(h => h.trim());
  const samProducts = samData.values.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });
  
  console.log(`📋 ${samProducts.length} SAM EDELMAN products in sheet\n`);
  
  // 2. Get ALL images from image_index
  let allImages = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("model_ref, color, filename, url")
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allImages = allImages.concat(data);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  // Build model_ref index (same as fetchProducts.ts does)
  const modelRefIndex = new Map();
  for (const img of allImages) {
    const mr = img.model_ref.toUpperCase();
    const cl = img.color.toUpperCase();
    const key = `${mr}|${cl}`;
    
    if (!modelRefIndex.has(mr)) {
      modelRefIndex.set(mr, new Map());
    }
    const colorMap = modelRefIndex.get(mr);
    if (!colorMap.has(cl)) {
      colorMap.set(cl, []);
    }
    colorMap.get(cl).push(img);
  }
  
  console.log(`📊 ${allImages.length} images, ${modelRefIndex.size} unique modelRefs\n`);
  
  // 3. For each SAM product, simulate the matching
  console.log("═".repeat(80));
  console.log("  SAM EDELMAN IMAGE MATCHING SIMULATION");
  console.log("═".repeat(80));
  
  let matched = 0;
  let unmatched = 0;
  
  for (const p of samProducts) {
    const itemCode = (p["קוד פריט"] || "").toUpperCase().trim();
    const color = (p["צבע"] || "").toUpperCase().trim();
    const modelName = (p["תיאור דגם"] || "").trim();
    
    // Extract modelRef same way as UPDATED fetchGoogleSheet.ts
    let modelRef = "";
    const parts = itemCode.split("-");
    if (itemCode.startsWith("HBSE")) {
      // HBSE bags: keep the HBSE code
      if (parts.length >= 3) {
        modelRef = parts.slice(0, 3).join("-");
      } else {
        modelRef = parts[0] || itemCode;
      }
    } else {
      // Non-HBSE: use model NAME for matching
      modelRef = modelName.toUpperCase().trim();
    }
    
    // Extract colorCode
    let colorCode = "";
    if (parts.length >= 4) {
      colorCode = parts[3]; // HBSE-xxx-xxx-COLOR
    } else if (parts.length >= 2) {
      colorCode = parts[1];
    }
    
    // Try to find images
    const mrUpper = modelRef.toUpperCase();
    const exactImages = modelRefIndex.get(mrUpper);
    
    let matchType = "NONE";
    let matchedImages = 0;
    let matchedColor = "";
    
    if (exactImages) {
      // Exact modelRef match exists
      const totalImgs = Array.from(exactImages.values()).reduce((sum, arr) => sum + arr.length, 0);
      
      // Check if color matches
      let colorMatch = false;
      for (const [imgColor, imgs] of exactImages) {
        const colorNorm = color.replace(/[^A-Z0-9]/g, "");
        const imgColorNorm = imgColor.replace(/[^A-Z0-9]/g, "");
        if (imgColor === color || imgColorNorm === colorNorm || 
            imgColorNorm.includes(colorNorm) || colorNorm.includes(imgColorNorm)) {
          colorMatch = true;
          matchedColor = imgColor;
          matchedImages = imgs.length;
          break;
        }
      }
      
      if (colorMatch) {
        matchType = "EXACT+COLOR";
      } else {
        matchType = `EXACT_REF_ONLY (${totalImgs} imgs, colors: ${Array.from(exactImages.keys()).join(",")})`;
        matchedImages = totalImgs;
      }
    } else {
      // Try prefix matching (same as fetchProducts.ts)
      for (let prefixLen = Math.min(7, mrUpper.length - 1); prefixLen >= 5; prefixLen--) {
        const prefix = mrUpper.substring(0, prefixLen);
        
        let prefixMatches = [];
        for (const [indexMr, colorMap] of modelRefIndex) {
          if (indexMr !== mrUpper && indexMr.startsWith(prefix)) {
            for (const [c, imgs] of colorMap) {
              prefixMatches.push({ modelRef: indexMr, color: c, count: imgs.length });
            }
          }
        }
        
        if (prefixMatches.length > 0) {
          // Check if any color matches
          let colorMatch = null;
          const colorNorm = color.replace(/[^A-Z0-9]/g, "");
          
          for (const pm of prefixMatches) {
            const pmColorNorm = pm.color.replace(/[^A-Z0-9]/g, "");
            if (pm.color === color || pmColorNorm === colorNorm ||
                pmColorNorm.includes(colorNorm) || colorNorm.includes(pmColorNorm) ||
                (colorNorm.length >= 4 && pmColorNorm.includes(colorNorm)) ||
                (pmColorNorm.length >= 4 && colorNorm.includes(pmColorNorm))) {
              colorMatch = pm;
              break;
            }
          }
          
          if (colorMatch) {
            matchType = `PREFIX(${prefixLen})+COLOR → ${colorMatch.modelRef}|${colorMatch.color}`;
            matchedImages = colorMatch.count;
            matchedColor = colorMatch.color;
          } else {
            const totalImgs = prefixMatches.reduce((sum, pm) => sum + pm.count, 0);
            const colors = [...new Set(prefixMatches.map(pm => pm.color))];
            matchType = `PREFIX(${prefixLen})_NO_COLOR (${totalImgs} imgs from ${prefixMatches.length} entries, colors: ${colors.slice(0, 5).join(",")})`;
            matchedImages = totalImgs;
          }
          break; // Found prefix match, stop
        }
      }
    }
    
    const icon = matchType.includes("NONE") ? "❌" : matchType.includes("COLOR") ? "✅" : "⚠️";
    console.log(`${icon} ${modelName} | code=${itemCode} | modelRef=${modelRef} | color=${color} | ${matchType} (${matchedImages} imgs)`);
    
    if (matchType.includes("NONE")) {
      unmatched++;
    } else {
      matched++;
    }
  }
  
  console.log(`\n📊 Results: ${matched} matched, ${unmatched} unmatched out of ${samProducts.length} products`);
}

main().catch(console.error);
