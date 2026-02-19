import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Extract model name from SAM EDELMAN filename
// ALIE_BLACK_J6428L1001BLG.jpg → "ALIE"
// BIANKA SLING_BLACK_I2677L2002HLG.jpg → "BIANKA SLING"
// VIENNA_BROWN_B3949L2200BLG.jpg → "VIENNA"
// ADDEY-J8549F1001-o.jpg → "ADDEY"
function extractModelName(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  
  // Underscore format: MODELNAME_COLOR_CODE.jpg
  if (nameWithoutExt.includes("_")) {
    const parts = nameWithoutExt.split("_");
    // Model name is the first part (may contain spaces like "BIANKA SLING")
    return parts[0].toUpperCase().trim();
  }
  
  // Dash format: MODELNAME-CODE-view.jpg  
  if (nameWithoutExt.includes("-")) {
    const parts = nameWithoutExt.split("-");
    return parts[0].toUpperCase().trim();
  }
  
  return null;
}

// Extract color from SAM EDELMAN filename
// ALIE_BLACK_J6428L1001BLG.jpg → "BLACK"
// BIANKA SLING_BLACK_I2677L2002HLG.jpg → "BLACK"
// ADDEY-J8549F1001-o.jpg → no color available
function extractColor(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  
  if (nameWithoutExt.includes("_")) {
    const parts = nameWithoutExt.split("_");
    if (parts.length >= 3) {
      return parts[1].toUpperCase().trim();
    }
  }
  
  return null;
}

async function main() {
  console.log("🔧 Re-indexing SAM EDELMAN images by MODEL NAME...\n");
  
  // Get ALL images from index
  let allImages = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("id, model_ref, color, filename")
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allImages = allImages.concat(data);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  console.log(`📊 ${allImages.length} total images in index`);
  
  // Known SAM EDELMAN model names from our uploads
  // These filenames start with the model name followed by _ or -
  const samModelNames = [
    "ALIE", "ALIE STUD", "ALTHEA", "BAY", "BIANKA SLING", "BIANKASLING3",
    "EVERETT", "GIGI", "HAZEL", "ISELLA", "KALLEN", "LINNIE",
    "LORAINE", "MARCIE", "MICHAELA", "MICHAELAJLLY", "NARRA",
    "ODETTE", "ONIA", "PAIGE", "RUE", "TALIA", "TAYLIN",
    "VIENNA", "WALLER", "WAYLON", "WEST", "ADDEY", "ALBIE",
    "ALBIE MESH"
  ];
  
  // Find SAM EDELMAN images - those whose filenames start with a known model name
  const samImages = allImages.filter(img => {
    const fn = img.filename.toUpperCase();
    return samModelNames.some(name => {
      const nameNorm = name.replace(/ /g, "_");
      const nameSpace = name.replace(/ /g, " ");
      return fn.startsWith(nameNorm + "_") || fn.startsWith(nameSpace + "_") || 
             fn.startsWith(name + "_") || fn.startsWith(name + "-");
    });
  });
  
  // Also find images that have old SAM EDELMAN model_refs (J/I/B/E/H codes)
  // but NOT HBSE codes (those are correct)
  const samCodePattern = /^[JIBEH][A-Z0-9]{4,}/;
  const oldSamImages = allImages.filter(img => {
    if (samImages.includes(img)) return false; // Already counted
    const mr = img.model_ref;
    return samCodePattern.test(mr) && !mr.startsWith("HBSE");
  });
  
  console.log(`🎯 ${samImages.length} SAM EDELMAN images found by filename`);
  console.log(`📋 ${oldSamImages.length} additional images with SAM-like codes\n`);
  
  let updated = 0;
  let alreadyCorrect = 0;
  let errors = 0;
  
  for (const img of samImages) {
    const modelName = extractModelName(img.filename);
    const color = extractColor(img.filename);
    
    if (!modelName) continue;
    
    const newModelRef = modelName;
    const newColor = color || img.color;
    
    if (img.model_ref === newModelRef && img.color === newColor) {
      alreadyCorrect++;
      continue;
    }
    
    const { error } = await supabase
      .from("image_index")
      .update({ 
        model_ref: newModelRef,
        color: newColor
      })
      .eq("id", img.id);
    
    if (error) {
      errors++;
      if (errors <= 5) console.error(`   ❌ ${img.filename}: ${error.message}`);
    } else {
      updated++;
      if (updated <= 30) {
        console.log(`   ✅ ${img.filename}: ${img.model_ref}|${img.color} → ${newModelRef}|${newColor}`);
      }
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Already correct: ${alreadyCorrect}`);
  console.log(`   ❌ Errors: ${errors}`);
  
  // Verify: count images per model name
  console.log(`\n📋 Image count per model name:`);
  const modelCounts = new Map();
  for (const img of samImages) {
    const modelName = extractModelName(img.filename);
    if (modelName) {
      if (!modelCounts.has(modelName)) modelCounts.set(modelName, { total: 0, colors: new Set() });
      modelCounts.get(modelName).total++;
      const color = extractColor(img.filename);
      if (color) modelCounts.get(modelName).colors.add(color);
    }
  }
  
  for (const [name, data] of Array.from(modelCounts.entries()).sort()) {
    console.log(`   ${name}: ${data.total} images, colors: ${Array.from(data.colors).join(", ")}`);
  }
}

main().catch(console.error);
