import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SAM EDELMAN model names that we uploaded images for
const SAM_MODEL_NAMES = [
  "ALIE", "BAY", "BIANKA SLING", "BIANKASLING3", "GIGI", "HAZEL",
  "KALLEN", "LINNIE", "MARCIE", "MICHAELA", "MICHAELAJLLY",
  "TALIA", "VIENNA", "WALLER"
];

// Extract the real item code from the filename code part
// e.g., "B3949L2002HLG" -> "B3949L2002" (strip 3-char view suffix)
// e.g., "J6428L1001BLG" -> "J6428L1001"
function extractItemCode(codePart) {
  // The view suffixes are 3 uppercase letters: BLG, HLG, ILG, OLG, TLG
  const match = codePart.match(/^(.+?)([A-Z]{3})$/);
  if (match) {
    const potentialCode = match[1];
    const suffix = match[2];
    // Verify the suffix looks like a view code (ends with LG, or known patterns)
    if (suffix.endsWith("LG") || ["BLG", "HLG", "ILG", "OLG", "TLG", "FLG", "SLG"].includes(suffix)) {
      return potentialCode;
    }
  }
  // No suffix found, return as-is
  return codePart;
}

async function main() {
  console.log("🔧 Fixing SAM EDELMAN image model_refs...\n");
  
  // Get all SAM item codes from the sheet for verification
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const samUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("נעליים SAM")}?key=${apiKey}`;
  const samRes = await fetch(samUrl);
  const samData = await samRes.json();
  
  const headers = samData.values[0].map(h => h.trim());
  const sheetItemCodes = new Set();
  
  samData.values.slice(1).forEach(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    const itemCode = (obj["קוד פריט"] || "").toUpperCase().trim();
    if (itemCode) sheetItemCodes.add(itemCode);
  });
  
  console.log(`📋 ${sheetItemCodes.size} unique item codes in SAM EDELMAN sheet`);
  console.log(`   Sample codes:`, Array.from(sheetItemCodes).slice(0, 10));
  
  // Get all newly uploaded SAM EDELMAN images
  // They have filenames like MODELNAME_COLOR_CODEVIEWSUFFIX.jpg
  let allImages = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("id, model_ref, color, filename, url")
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allImages = allImages.concat(data);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  console.log(`📊 ${allImages.length} total images in index`);
  
  // Filter to SAM EDELMAN images (those matching our model names)
  const samImages = allImages.filter(img => {
    const fn = img.filename.toUpperCase();
    return SAM_MODEL_NAMES.some(name => {
      const nameUpper = name.replace(/ /g, "_").toUpperCase();
      return fn.startsWith(nameUpper + "_") || fn.startsWith(name.toUpperCase() + "_");
    });
  });
  
  console.log(`🎯 ${samImages.length} SAM EDELMAN images to check\n`);
  
  let fixed = 0;
  let alreadyCorrect = 0;
  let notFound = 0;
  let errors = 0;
  
  for (const img of samImages) {
    const fn = img.filename;
    const parts = fn.replace(/\.(jpg|jpeg|png|webp)$/i, "").split("_");
    
    if (parts.length < 3) {
      // Dash format (e.g., ADDEY-J8549F1001-o.jpg) - no fix needed
      continue;
    }
    
    // parts[0] = model name, parts[1] = color, parts[2+] = code+view
    const codePart = parts.slice(2).join("_"); // In case there are more underscores
    const extractedCode = extractItemCode(codePart);
    
    if (!extractedCode) continue;
    
    const correctModelRef = extractedCode.toUpperCase();
    const currentModelRef = img.model_ref.toUpperCase();
    
    if (correctModelRef === currentModelRef) {
      alreadyCorrect++;
      continue;
    }
    
    // Verify the extracted code exists in the sheet (optional but safe)
    const inSheet = sheetItemCodes.has(correctModelRef);
    
    // Update the model_ref
    const { error } = await supabase
      .from("image_index")
      .update({ model_ref: correctModelRef })
      .eq("id", img.id);
    
    if (error) {
      errors++;
      console.error(`   ❌ Error updating ${fn}:`, error.message);
    } else {
      fixed++;
      if (fixed <= 20) {
        console.log(`   ✅ ${fn}: ${currentModelRef} → ${correctModelRef} ${inSheet ? '(in sheet)' : '(NOT in sheet)'}`);
      }
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ⏭️  Already correct: ${alreadyCorrect}`);
  console.log(`   ❌ Errors: ${errors}`);
}

main().catch(console.error);
