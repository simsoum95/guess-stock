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
const BUCKET = "guess-images";
const STORAGE_FOLDER = "products";

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

// Parse GUESS filename - handles ALL formats:
// 1. GWAISHA_BLK01_BZ.jpg  (underscore everywhere)
// 2. GWCERINNA_BLK01-BZ.jpg (underscore + dash)
// 3. GMLALAK-WHI02-BZ.jpg  (dash everywhere)
function parseGuessFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  
  // View type suffixes to detect
  const viewTypes = ["BZ", "OZ", "PZ", "RZ", "TZ", "XZ", "CP"];
  
  // Format 3: ALL DASHES - MODEL-COLOR-VIEW.jpg
  const allDashMatch = nameWithoutExt.match(/^([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)$/i);
  if (allDashMatch && viewTypes.includes(allDashMatch[3].toUpperCase())) {
    return {
      modelRef: allDashMatch[1].toUpperCase(),
      color: allDashMatch[2].toUpperCase(),
      viewType: allDashMatch[3].toUpperCase()
    };
  }
  
  // Format 2: UNDERSCORE + DASH - MODEL_COLOR-VIEW.jpg
  const mixedMatch = nameWithoutExt.match(/^(.+?)_([A-Z0-9]+)-([A-Z0-9]+)$/i);
  if (mixedMatch && viewTypes.includes(mixedMatch[3].toUpperCase())) {
    return {
      modelRef: mixedMatch[1].toUpperCase(),
      color: mixedMatch[2].toUpperCase(),
      viewType: mixedMatch[3].toUpperCase()
    };
  }
  
  // Format 1: ALL UNDERSCORES - MODEL_COLOR_VIEW.jpg or MODEL_COLOR_NUMBER.jpg
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

// Parse SAM EDELMAN filename
// Formats:
// - ALIE_BEIGE_J6428L1250BLG.jpg -> modelName: ALIE, color: BEIGE
// - ALIE STUD_BLACK_J6502L1001BLG.jpg -> modelName: ALIE STUD, color: BLACK
// - ADDEY-J8549F1001-o.jpg -> modelName: ADDEY, color from code
// - HAZEL-J7007L1001-o.jpg -> modelName: HAZEL, color from code
function parseSamFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  
  // Format with underscore: MODELNAME_COLOR_CODE+VIEW.jpg
  if (nameWithoutExt.includes("_")) {
    const parts = nameWithoutExt.split("_");
    if (parts.length >= 3) {
      return {
        modelName: parts[0].toUpperCase().trim(),
        color: parts[1].toUpperCase().trim(),
        code: parts[2] || ""
      };
    } else if (parts.length === 2) {
      return {
        modelName: parts[0].toUpperCase().trim(),
        color: "",
        code: parts[1] || ""
      };
    }
  }
  
  // Format with dash: MODELNAME-CODE-view.jpg
  const dashParts = nameWithoutExt.split("-");
  if (dashParts.length >= 2) {
    return {
      modelName: dashParts[0].toUpperCase().trim(),
      color: "",
      code: dashParts.slice(1).join("-")
    };
  }
  
  return null;
}

async function getExistingFilenames() {
  console.log("📊 Loading existing image index...");
  const existing = new Set();
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  let total = 0;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("filename")
      .range(offset, offset + pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    data.forEach(img => {
      if (img.filename) existing.add(img.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase());
      total++;
    });
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  console.log(`   ${total} images in index\n`);
  return existing;
}

async function uploadAndIndex(filePath, filename, modelRef, color) {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${STORAGE_FOLDER}/${filename}`;
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  
  if (uploadError && !uploadError.message.includes("already exists")) {
    throw new Error(`Upload: ${uploadError.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);
  
  // Index with filename as unique key
  const { data: existingRow } = await supabase
    .from("image_index")
    .select("id")
    .eq("filename", filename)
    .single();
  
  if (existingRow) {
    const { error } = await supabase
      .from("image_index")
      .update({ model_ref: modelRef, color: color, url: urlData.publicUrl })
      .eq("filename", filename);
    if (error) throw new Error(`Index update: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("image_index")
      .insert({
        model_ref: modelRef,
        color: color,
        filename: filename,
        url: urlData.publicUrl,
      });
    if (error) throw new Error(`Index insert: ${error.message}`);
  }
}

async function getSamNeededModels() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  
  // Get existing model refs
  let existingModelRefs = new Set();
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("model_ref")
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    data.forEach(d => existingModelRefs.add(d.model_ref.toUpperCase()));
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  // Get SAM products from sheet
  const samUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("נעליים SAM")}?key=${apiKey}`;
  const samRes = await fetch(samUrl);
  const samData = await samRes.json();
  
  const headers = samData.values[0].map(h => h.trim());
  const samProducts = samData.values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
  
  // Find model names that need images
  const modelNamesNeedingImages = new Set();
  const modelNameToItemCodes = new Map();
  
  for (const p of samProducts) {
    const modelName = (p["תיאור דגם"] || "").toUpperCase().trim();
    const itemCode = (p["קוד פריט"] || "").toUpperCase().trim();
    
    if (!modelName) continue;
    
    if (!modelNameToItemCodes.has(modelName)) {
      modelNameToItemCodes.set(modelName, new Set());
    }
    if (itemCode) modelNameToItemCodes.get(modelName).add(itemCode);
    
    // Check if any of this model's item codes have images
    const codeBase = itemCode.split("-").slice(0, 2).join("-");
    if (!existingModelRefs.has(itemCode) && !existingModelRefs.has(codeBase)) {
      modelNamesNeedingImages.add(modelName);
    }
  }
  
  return { modelNamesNeedingImages, modelNameToItemCodes };
}

async function main() {
  const mode = process.argv[2] || "both"; // "guess", "sam", or "both"
  
  const existingFilenames = await getExistingFilenames();
  
  // ============ GUESS SHOES ============
  if (mode === "guess" || mode === "both") {
    console.log("═".repeat(60));
    console.log("  UPLOADING GUESS SHOES IMAGES");
    console.log("═".repeat(60));
    
    const guessFiles = listImagesRecursive(GUESS_FOLDER);
    console.log(`📁 ${guessFiles.length} total files\n`);
    
    // Find files to upload
    const toUpload = [];
    let skipped = 0;
    let unparsed = 0;
    
    for (const file of guessFiles) {
      const parsed = parseGuessFilename(file.name);
      if (!parsed) { unparsed++; continue; }
      if (parsed.viewType === "CP") continue; // Skip thumbnails
      
      const filenameKey = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase();
      if (existingFilenames.has(filenameKey)) {
        skipped++;
        continue;
      }
      
      toUpload.push({ ...file, modelRef: parsed.modelRef, color: parsed.color, viewType: parsed.viewType });
    }
    
    console.log(`🆕 ${toUpload.length} new files to upload`);
    console.log(`⏭️  ${skipped} already exist, ${unparsed} unparseable`);
    
    if (toUpload.length > 0) {
      let uploaded = 0;
      let errors = 0;
      
      for (const file of toUpload) {
        try {
          await uploadAndIndex(file.fullPath, file.name, file.modelRef, file.color);
          uploaded++;
          if (uploaded % 50 === 0) {
            console.log(`   ✅ ${uploaded}/${toUpload.length} uploaded...`);
          }
        } catch (err) {
          errors++;
          if (errors <= 5) console.error(`   ❌ ${file.name}: ${err.message}`);
        }
      }
      
      console.log(`\n✅ GUESS upload complete: ${uploaded} uploaded, ${errors} errors\n`);
    }
  }
  
  // ============ SAM EDELMAN ============
  if (mode === "sam" || mode === "both") {
    console.log("═".repeat(60));
    console.log("  UPLOADING SAM EDELMAN IMAGES (SMART)");
    console.log("═".repeat(60));
    
    const { modelNamesNeedingImages, modelNameToItemCodes } = await getSamNeededModels();
    console.log(`📋 Models needing images: ${modelNamesNeedingImages.size}`);
    console.log(`   ${Array.from(modelNamesNeedingImages).join(", ")}\n`);
    
    const samFiles = listImagesRecursive(SAM_FOLDER);
    console.log(`📁 ${samFiles.length} total files in folder`);
    
    // Match files to needed models
    const toUpload = [];
    let skippedNotNeeded = 0;
    let skippedExisting = 0;
    
    for (const file of samFiles) {
      const parsed = parseSamFilename(file.name);
      if (!parsed) continue;
      
      // Check if this model is needed
      let matchedModel = null;
      for (const modelName of modelNamesNeedingImages) {
        const modelVariants = [
          modelName,
          modelName.replace(/ /g, "_"),
          modelName.replace(/ /g, "-"),
          modelName.replace(/ /g, ""),
        ];
        
        for (const variant of modelVariants) {
          if (parsed.modelName === variant || parsed.modelName.startsWith(variant)) {
            // Avoid too-broad matches: if parsed model name is much longer, skip
            // Unless the model name is a single word
            if (parsed.modelName.length > variant.length + 3 && variant.includes(" ")) continue;
            matchedModel = modelName;
            break;
          }
        }
        if (matchedModel) break;
      }
      
      if (!matchedModel) {
        skippedNotNeeded++;
        continue;
      }
      
      // Check if already exists
      const filenameKey = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase();
      if (existingFilenames.has(filenameKey)) {
        skippedExisting++;
        continue;
      }
      
      // Get the item code for this model from the sheet
      const itemCodes = modelNameToItemCodes.get(matchedModel);
      const baseItemCode = itemCodes && itemCodes.size > 0 ? Array.from(itemCodes)[0] : matchedModel;
      
      // Use itemCode as model_ref and parsed color for the index
      const color = parsed.color || "DEFAULT";
      
      toUpload.push({
        ...file,
        modelRef: baseItemCode,
        color: color,
        matchedModel
      });
    }
    
    console.log(`🆕 ${toUpload.length} files to upload`);
    console.log(`⏭️  ${skippedNotNeeded} not needed, ${skippedExisting} already exist`);
    
    // Group by model for summary
    const byModel = new Map();
    toUpload.forEach(f => {
      if (!byModel.has(f.matchedModel)) byModel.set(f.matchedModel, []);
      byModel.get(f.matchedModel).push(f);
    });
    
    console.log(`\nFiles per model to upload:`);
    for (const [model, files] of byModel) {
      console.log(`   ${model}: ${files.length} files (modelRef: ${files[0].modelRef})`);
    }
    
    if (toUpload.length > 0) {
      let uploaded = 0;
      let errors = 0;
      
      for (const file of toUpload) {
        try {
          await uploadAndIndex(file.fullPath, file.name, file.modelRef, file.color);
          uploaded++;
          if (uploaded % 20 === 0) {
            console.log(`   ✅ ${uploaded}/${toUpload.length} uploaded...`);
          }
        } catch (err) {
          errors++;
          if (errors <= 5) console.error(`   ❌ ${file.name}: ${err.message}`);
        }
      }
      
      console.log(`\n✅ SAM EDELMAN upload complete: ${uploaded} uploaded, ${errors} errors\n`);
    }
  }
  
  console.log("🎉 ALL DONE!");
}

main().catch(console.error);
