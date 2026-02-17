import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GUESS_FOLDER = "C:\\Users\\1\\Downloads\\GUESS SHOES-20260217T100644Z-1-001";
const SAM_FOLDER = "C:\\Users\\1\\Downloads\\SAM EDELMAN-20260217T101426Z-1-001";

function listImagesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...listImagesRecursive(fullPath));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(item.name)) {
      results.push({ name: item.name, fullPath });
    }
  }
  return results;
}

// Parse GUESS filename - handles both underscore and dash formats
// Format 1: GWAISHA_BLK01_BZ.jpg (all underscore)
// Format 2: GWCERINNA_BLK01-BZ.jpg (dash before view type)
function parseGuessFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  
  // Handle dash-before-viewtype format: MODEL_COLOR-VIEWTYPE
  // First check for FORMAT: MODEL_COLOR-VIEWTYPE
  const dashMatch = nameWithoutExt.match(/^(.+?)_([A-Z0-9]+)-([A-Z0-9]+)$/i);
  if (dashMatch) {
    return { 
      modelRef: dashMatch[1].toUpperCase(), 
      color: dashMatch[2].toUpperCase(), 
      viewType: dashMatch[3].toUpperCase() 
    };
  }
  
  // Handle all underscore format: MODEL_COLOR_VIEWTYPE or MODEL_COLOR_NUMBER
  const parts = nameWithoutExt.split("_");
  if (parts.length >= 2) {
    return { 
      modelRef: parts[0].toUpperCase(), 
      color: parts[1].toUpperCase(), 
      viewType: (parts[2] || "").toUpperCase() 
    };
  }
  
  return null;
}

async function getExistingIndex() {
  console.log("📊 Loading existing image index...");
  let allData = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("model_ref, color, filename")
      .range(offset, offset + pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  console.log(`   ${allData.length} images in index\n`);
  return allData;
}

async function main() {
  const existingIndex = await getExistingIndex();
  
  // Build lookup sets
  const existingFilenames = new Set();
  const existingModelRefs = new Set();
  const existingModelColorKeys = new Set();
  
  for (const img of existingIndex) {
    if (img.filename) existingFilenames.add(img.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase());
    existingModelRefs.add(img.model_ref.toUpperCase());
    existingModelColorKeys.add(`${img.model_ref}|${img.color}`.toUpperCase());
  }

  // ============ GUESS SHOES ============
  console.log("═".repeat(60));
  console.log("  GUESS SHOES - DETAILED ANALYSIS");
  console.log("═".repeat(60));
  
  const guessFiles = listImagesRecursive(GUESS_FOLDER);
  console.log(`📁 Total files: ${guessFiles.length}\n`);
  
  // Parse all filenames with improved parser
  let parsed = 0;
  let unparsed = 0;
  const unparsedSamples = [];
  const newModelColors = new Map(); // key -> {modelRef, color, files: [{name, viewType}]}
  const existingCount = { byFilename: 0, byModelColor: 0 };
  const newFilesToUpload = [];
  
  for (const file of guessFiles) {
    const p = parseGuessFilename(file.name);
    if (!p) { 
      unparsed++; 
      if (unparsedSamples.length < 10) unparsedSamples.push(file.name);
      continue; 
    }
    parsed++;
    
    // Skip CP thumbnails
    if (p.viewType === "CP") continue;
    
    const filenameKey = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase();
    
    if (existingFilenames.has(filenameKey)) {
      existingCount.byFilename++;
      continue;
    }
    
    // This is a new file we need to upload
    newFilesToUpload.push({ ...file, ...p });
    
    const mcKey = `${p.modelRef}|${p.color}`;
    if (!newModelColors.has(mcKey)) {
      newModelColors.set(mcKey, { modelRef: p.modelRef, color: p.color, files: [] });
    }
    newModelColors.get(mcKey).files.push({ name: file.name, viewType: p.viewType, fullPath: file.fullPath });
  }
  
  console.log(`✅ Parsed: ${parsed}, ❌ Unparsed: ${unparsed}`);
  if (unparsedSamples.length > 0) {
    console.log(`   Unparsed samples:`, unparsedSamples);
  }
  console.log(`⏭️  Already exist: ${existingCount.byFilename} files`);
  console.log(`🆕 NEW files to upload: ${newFilesToUpload.length}`);
  console.log(`🆕 NEW model+color combinations: ${newModelColors.size}`);
  
  // Count new models (not just new model+color combos)
  const newModelRefs = new Set();
  for (const [key, data] of newModelColors) {
    if (!existingModelRefs.has(data.modelRef)) {
      newModelRefs.add(data.modelRef);
    }
  }
  console.log(`🆕 Completely NEW models (no images at all): ${newModelRefs.size}`);
  
  // View type distribution for new files
  const viewTypeDist = {};
  newFilesToUpload.forEach(f => {
    const vt = f.viewType || "UNKNOWN";
    viewTypeDist[vt] = (viewTypeDist[vt] || 0) + 1;
  });
  console.log(`📊 New files view types:`, viewTypeDist);

  // ============ SAM EDELMAN ============
  console.log("\n" + "═".repeat(60));
  console.log("  SAM EDELMAN - DETAILED ANALYSIS");
  console.log("═".repeat(60));
  
  // Get SAM products from sheet
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const samUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("נעליים SAM")}?key=${apiKey}`;
  const samRes = await fetch(samUrl);
  const samData = await samRes.json();
  
  const headers = samData.values[0];
  const samProducts = samData.values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (row[i] || "").trim(); });
    return obj;
  });
  
  console.log(`📋 SAM EDELMAN products in Sheet: ${samProducts.length}`);
  
  // Extract model names and itemCodes from sheet
  const sheetModelNames = new Map(); // modelName -> { itemCode, color, ... }
  const sheetItemCodes = new Map(); // itemCode base -> products[]
  
  for (const p of samProducts) {
    const modelName = (p["תיאור דגם"] || "").toUpperCase().trim();
    const itemCode = (p["קוד פריט"] || "").toUpperCase().trim();
    const color = (p["צבע"] || "").toUpperCase().trim();
    
    if (modelName) {
      if (!sheetModelNames.has(modelName)) {
        sheetModelNames.set(modelName, []);
      }
      sheetModelNames.get(modelName).push({ itemCode, color, modelName });
    }
    
    if (itemCode) {
      // Extract base code (e.g., HBSE-324 from HBSE-324-0050)
      const parts = itemCode.split("-");
      const base = parts.slice(0, 2).join("-");
      if (!sheetItemCodes.has(base)) {
        sheetItemCodes.set(base, []);
      }
      sheetItemCodes.get(base).push({ itemCode, color, modelName });
    }
  }
  
  console.log(`📋 Unique model names in Sheet: ${sheetModelNames.size}`);
  console.log(`📋 Sample model names:`, Array.from(sheetModelNames.keys()).slice(0, 15));
  
  // Check which models already have images
  const samModelsWithImages = new Set();
  const samModelsNeedImages = new Set();
  
  for (const [modelName, products] of sheetModelNames) {
    let hasImage = false;
    for (const p of products) {
      if (p.itemCode) {
        // Check by itemCode (e.g., HBSE-324-0050)
        const codeBase = p.itemCode.split("-").slice(0, 2).join("-");
        if (existingModelRefs.has(p.itemCode) || existingModelRefs.has(codeBase)) {
          hasImage = true;
          break;
        }
      }
    }
    if (hasImage) {
      samModelsWithImages.add(modelName);
    } else {
      samModelsNeedImages.add(modelName);
    }
  }
  
  console.log(`✅ Models already with images: ${samModelsWithImages.size}`);
  console.log(`❌ Models NEEDING images: ${samModelsNeedImages.size}`);
  if (samModelsNeedImages.size > 0) {
    console.log(`   Models needing images:`, Array.from(samModelsNeedImages).slice(0, 30));
  }
  
  // Now check SAM EDELMAN folder
  const samFiles = listImagesRecursive(SAM_FOLDER);
  console.log(`\n📁 Total SAM files in folder: ${samFiles.length}`);
  
  // Try to match filenames to sheet model names
  // SAM filenames like: ALIE STUD_BLACK_J6502L1001BLG.jpg
  // Model name is first part: ALIE STUD
  let matchedCount = 0;
  let unmatchedCount = 0;
  const matchedByModel = new Map(); // modelName -> files[]
  const unmatchedModels = new Set();
  const filesToUploadSam = [];
  
  for (const file of samFiles) {
    const fnUpper = file.name.toUpperCase();
    let matched = false;
    
    for (const [modelName] of sheetModelNames) {
      // Check if filename starts with the model name (with underscore or dash after)
      const modelNameNorm = modelName.replace(/\s+/g, " ");
      const fnModelPart = fnUpper.split(/[_-]/)[0].trim();
      
      // Also try matching with spaces converted to underscores/dashes
      const modelVariants = [
        modelNameNorm,
        modelNameNorm.replace(/ /g, "_"),
        modelNameNorm.replace(/ /g, "-"),
        modelNameNorm.replace(/ /g, ""),
      ];
      
      const fnVariants = [
        fnModelPart,
        fnUpper.split("_")[0].trim(),
        fnUpper.split("-")[0].trim(),
      ];
      
      for (const mv of modelVariants) {
        for (const fv of fnVariants) {
          if (fv === mv || fnUpper.startsWith(mv + "_") || fnUpper.startsWith(mv + "-") || fnUpper.startsWith(mv + " ")) {
            matched = true;
            if (!matchedByModel.has(modelName)) matchedByModel.set(modelName, []);
            matchedByModel.get(modelName).push(file);
            
            // Check if this model needs images
            if (samModelsNeedImages.has(modelName)) {
              filesToUploadSam.push({ ...file, modelName });
            }
            break;
          }
        }
        if (matched) break;
      }
      if (matched) break;
    }
    
    if (matched) {
      matchedCount++;
    } else {
      unmatchedCount++;
      const firstPart = fnUpper.split(/[_-]/)[0].trim();
      unmatchedModels.add(firstPart);
    }
  }
  
  console.log(`\n📊 Files matching Sheet model names: ${matchedCount}`);
  console.log(`📊 Files NOT matching: ${unmatchedCount}`);
  console.log(`📊 Matched models: ${matchedByModel.size} / ${sheetModelNames.size}`);
  
  // Show which models from sheet were matched and which weren't
  const matchedSheetModels = Array.from(matchedByModel.keys());
  const unmatchedSheetModels = Array.from(sheetModelNames.keys()).filter(m => !matchedByModel.has(m));
  
  console.log(`\n✅ Sheet models FOUND in folder (${matchedSheetModels.length}):`);
  matchedSheetModels.forEach(m => {
    const fileCount = matchedByModel.get(m).length;
    const needsImg = samModelsNeedImages.has(m) ? "🆕 NEEDS UPLOAD" : "✅ already has images";
    console.log(`   ${m}: ${fileCount} files - ${needsImg}`);
  });
  
  if (unmatchedSheetModels.length > 0) {
    console.log(`\n❌ Sheet models NOT found in folder (${unmatchedSheetModels.length}):`);
    unmatchedSheetModels.forEach(m => {
      const products = sheetModelNames.get(m);
      console.log(`   ${m} (${products.map(p=>p.itemCode).join(", ")})`);
    });
  }
  
  console.log(`\n🎯 FINAL SUMMARY:`);
  console.log(`   GUESS SHOES: ${newFilesToUpload.length} new files to upload`);
  
  const neededSamModels = Array.from(matchedByModel.entries()).filter(([m]) => samModelsNeedImages.has(m));
  const neededSamFiles = neededSamModels.reduce((sum, [, files]) => sum + files.length, 0);
  console.log(`   SAM EDELMAN: ${neededSamFiles} files needed for ${neededSamModels.length} models (out of ${samFiles.length} total files in folder)`);
}

main().catch(console.error);
