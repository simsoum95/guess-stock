import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============ CONFIGURATION ============
const GUESS_FOLDER = "C:\\Users\\1\\Downloads\\GUESS SHOES-20260217T100644Z-1-001";
const SAM_FOLDER = "C:\\Users\\1\\Downloads\\SAM EDELMAN-20260217T101426Z-1-001";

// ============ HELPERS ============

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

function parseGuessFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const parts = nameWithoutExt.split("_");
  if (parts.length >= 2) {
    return { modelRef: parts[0].toUpperCase(), color: parts[1].toUpperCase(), viewType: parts[2] || "" };
  }
  return null;
}

function parseSamFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  // SAM EDELMAN format varies: HBSE-MODELNAME-COLOR_angle.jpg or similar
  // Try dash format: HBSE-XXXX-COLOR-...
  const parts = nameWithoutExt.split(/[-_]/);
  if (parts.length >= 2) {
    // Try to find model ref (usually starts with HBSE, FESE, SBSE etc.)
    let modelRef = parts[0].toUpperCase();
    let color = parts.length >= 3 ? parts[parts.length - 1].toUpperCase() : "UNKNOWN";
    
    // If first part is a prefix like HBSE, combine with second part
    if (["HBSE", "FESE", "SBSE", "SESE"].includes(modelRef) && parts.length >= 2) {
      modelRef = `${parts[0]}-${parts[1]}`.toUpperCase();
      color = parts.length >= 3 ? parts[2].toUpperCase() : "UNKNOWN";
    }
    
    return { modelRef, color };
  }
  return null;
}

async function getExistingIndex() {
  console.log("📊 Loading existing image index from Supabase...");
  let allData = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("model_ref, color, filename")
      .range(offset, offset + pageSize - 1);
    
    if (error) { console.error("Error:", error); break; }
    if (!data || data.length === 0) { hasMore = false; break; }
    allData = allData.concat(data);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }
  
  console.log(`   ${allData.length} total images in index\n`);
  return allData;
}

async function getSheetProducts() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!sheetId || !apiKey) {
    console.log("⚠️ Google Sheet credentials not available, skipping product check");
    return [];
  }
  
  // Get sheet names first
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}&fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl);
  const metaData = await metaRes.json();
  const sheetNames = metaData.sheets.map(s => s.properties.title);
  console.log("📋 Sheet names:", sheetNames.join(", "));
  
  const allProducts = [];
  
  for (const sheetName of sheetNames) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.values || data.values.length < 2) continue;
    
    const headers = data.values[0].map(h => h.trim());
    const rows = data.values.slice(1);
    
    for (const row of rows) {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ""; });
      obj._sheetName = sheetName;
      allProducts.push(obj);
    }
  }
  
  return allProducts;
}

// ============ MAIN ANALYSIS ============

async function main() {
  const existingIndex = await getExistingIndex();
  
  // Build sets for fast lookup
  const existingFilenames = new Set();
  const existingModelColors = new Set();
  const existingModelRefs = new Set();
  
  for (const img of existingIndex) {
    if (img.filename) existingFilenames.add(img.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase());
    const key = `${img.model_ref}|${img.color}`.toUpperCase();
    existingModelColors.add(key);
    existingModelRefs.add(img.model_ref.toUpperCase());
  }
  
  // ============ GUESS SHOES ANALYSIS ============
  console.log("═".repeat(60));
  console.log("  GUESS SHOES FOLDER ANALYSIS");
  console.log("═".repeat(60));
  
  if (fs.existsSync(GUESS_FOLDER)) {
    const guessFiles = listImagesRecursive(GUESS_FOLDER);
    console.log(`📁 Total image files: ${guessFiles.length}`);
    
    // Parse and analyze
    const guessProducts = new Map(); // modelRef -> Set of colors
    const newFiles = [];
    const existingFiles = [];
    let unparseable = 0;
    
    for (const file of guessFiles) {
      const parsed = parseGuessFilename(file.name);
      if (!parsed) { unparseable++; continue; }
      
      if (!guessProducts.has(parsed.modelRef)) {
        guessProducts.set(parsed.modelRef, new Set());
      }
      guessProducts.get(parsed.modelRef).add(parsed.color);
      
      const filenameKey = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase();
      if (existingFilenames.has(filenameKey)) {
        existingFiles.push(file);
      } else {
        newFiles.push(file);
      }
    }
    
    // Check which modelRefs we already have images for
    let modelRefsWithImages = 0;
    let modelRefsWithoutImages = 0;
    const missingModelRefs = [];
    
    for (const [modelRef, colors] of guessProducts) {
      if (existingModelRefs.has(modelRef)) {
        modelRefsWithImages++;
      } else {
        modelRefsWithoutImages++;
        missingModelRefs.push({ modelRef, colors: Array.from(colors) });
      }
    }
    
    console.log(`📦 Unique products (modelRef): ${guessProducts.size}`);
    console.log(`✅ Already have images for: ${modelRefsWithImages} models`);
    console.log(`🆕 Missing images for: ${modelRefsWithoutImages} models`);
    console.log(`📄 Files already in index: ${existingFiles.length}`);
    console.log(`🆕 New files NOT in index: ${newFiles.length}`);
    if (unparseable > 0) console.log(`⚠️ Unparseable filenames: ${unparseable}`);
    
    // Show samples of new files
    if (newFiles.length > 0) {
      console.log(`\nSample NEW files (first 15):`);
      newFiles.slice(0, 15).forEach(f => console.log(`   ${f.name}`));
    }
    
    if (missingModelRefs.length > 0) {
      console.log(`\nModels we're MISSING images for (first 20):`);
      missingModelRefs.slice(0, 20).forEach(m => 
        console.log(`   ${m.modelRef} (colors: ${m.colors.join(", ")})`)
      );
    }
    
    // Count new files by view type
    const viewTypeCounts = {};
    newFiles.forEach(f => {
      const parsed = parseGuessFilename(f.name);
      if (parsed) {
        const vt = parsed.viewType || "UNKNOWN";
        viewTypeCounts[vt] = (viewTypeCounts[vt] || 0) + 1;
      }
    });
    console.log(`\nNew files by view type:`, viewTypeCounts);
    
  } else {
    console.log("❌ Folder not found:", GUESS_FOLDER);
    // Try to find similar folders
    const dlFolder = "C:\\Users\\1\\Downloads";
    if (fs.existsSync(dlFolder)) {
      const dirs = fs.readdirSync(dlFolder).filter(d => d.toLowerCase().includes("guess"));
      console.log("   Similar folders found:", dirs);
    }
  }
  
  // ============ SAM EDELMAN ANALYSIS ============
  console.log("\n" + "═".repeat(60));
  console.log("  SAM EDELMAN FOLDER ANALYSIS");
  console.log("═".repeat(60));
  
  // First get products from Google Sheet to know what we need
  const allSheetProducts = await getSheetProducts();
  const samProducts = allSheetProducts.filter(p => {
    const sheet = p._sheetName?.toLowerCase() || "";
    return sheet.includes("sam") || sheet.includes("edelman");
  });
  
  // Extract SAM EDELMAN model refs from sheet
  const samSheetModelRefs = new Set();
  const samSheetItems = [];
  for (const p of samProducts) {
    const modelRef = (p["קוד גם"] || p["modelRef"] || p["ModelRef"] || p["קוד דגם"] || "").toUpperCase().trim();
    const itemCode = (p["קוד פריט"] || p["itemCode"] || p["ItemCode"] || "").toUpperCase().trim();
    const color = (p["צבע"] || p["color"] || p["Color"] || "").toUpperCase().trim();
    if (modelRef) {
      samSheetModelRefs.add(modelRef);
      samSheetItems.push({ modelRef, itemCode, color });
    }
  }
  
  console.log(`📋 SAM EDELMAN products in Google Sheet: ${samProducts.length}`);
  console.log(`📋 Unique SAM EDELMAN modelRefs in Sheet: ${samSheetModelRefs.size}`);
  
  // Check which SAM models already have images
  const samModelsWithImages = new Set();
  const samModelsWithoutImages = new Set();
  for (const modelRef of samSheetModelRefs) {
    if (existingModelRefs.has(modelRef)) {
      samModelsWithImages.add(modelRef);
    } else {
      samModelsWithoutImages.add(modelRef);
    }
  }
  
  console.log(`✅ SAM models already with images: ${samModelsWithImages.size}`);
  console.log(`❌ SAM models MISSING images: ${samModelsWithoutImages.size}`);
  
  if (samModelsWithoutImages.size > 0) {
    console.log(`\nSAM models missing images (first 30):`);
    Array.from(samModelsWithoutImages).slice(0, 30).forEach(m => console.log(`   ${m}`));
  }
  
  if (fs.existsSync(SAM_FOLDER)) {
    const samFiles = listImagesRecursive(SAM_FOLDER);
    console.log(`\n📁 Total SAM EDELMAN image files in folder: ${samFiles.length}`);
    
    // Show sample filenames to understand format
    console.log(`\nSample filenames (first 30):`);
    samFiles.slice(0, 30).forEach(f => console.log(`   ${f.name} (path: ${f.fullPath.replace(SAM_FOLDER, "...")})`));
    
    // Try to extract model refs from filenames
    const folderModelRefs = new Map(); // modelRef -> count of files
    let matchedToSheet = 0;
    let notInSheet = 0;
    const matchedFiles = [];
    const unmatchedRefs = new Set();
    
    for (const file of samFiles) {
      // Try to match filename to sheet model refs
      const fnUpper = file.name.toUpperCase().replace(/\.(jpg|jpeg|png|webp)$/i, "");
      
      let matched = false;
      for (const sheetRef of samSheetModelRefs) {
        // Check if filename contains the model ref
        if (fnUpper.includes(sheetRef.replace(/-/g, "")) || fnUpper.includes(sheetRef)) {
          if (!folderModelRefs.has(sheetRef)) folderModelRefs.set(sheetRef, 0);
          folderModelRefs.set(sheetRef, folderModelRefs.get(sheetRef) + 1);
          matched = true;
          matchedFiles.push(file);
          break;
        }
      }
      
      if (!matched) {
        notInSheet++;
        // Try to extract a model ref
        const parsed = parseSamFilename(file.name);
        if (parsed) unmatchedRefs.add(parsed.modelRef);
      }
    }
    
    console.log(`\n📊 Files matching Sheet products: ${matchedFiles.length}`);
    console.log(`📊 Files NOT matching any Sheet product: ${notInSheet}`);
    console.log(`📊 Unique modelRefs matched to Sheet: ${folderModelRefs.size}`);
    
    // Show matched models and how many files per model
    if (folderModelRefs.size > 0) {
      console.log(`\nMatched models (first 30):`);
      Array.from(folderModelRefs.entries()).slice(0, 30).forEach(([ref, count]) => {
        const hasImg = existingModelRefs.has(ref) ? "✅ already has images" : "🆕 NEEDS images";
        console.log(`   ${ref}: ${count} files - ${hasImg}`);
      });
    }
    
    // How many matched models need images?
    const neededModels = Array.from(folderModelRefs.keys()).filter(ref => !existingModelRefs.has(ref));
    const neededFiles = matchedFiles.filter(f => {
      const fnUpper = f.name.toUpperCase().replace(/\.(jpg|jpeg|png|webp)$/i, "");
      return neededModels.some(ref => fnUpper.includes(ref.replace(/-/g, "")) || fnUpper.includes(ref));
    });
    
    console.log(`\n🎯 SUMMARY: ${neededModels.length} models need images, ${neededFiles.length} files would need to be uploaded`);
    console.log(`   (Instead of uploading all ${samFiles.length} files)`);
    
    if (unmatchedRefs.size > 0 && unmatchedRefs.size < 30) {
      console.log(`\nUnmatched model refs from folder (not in Sheet):`);
      Array.from(unmatchedRefs).slice(0, 20).forEach(r => console.log(`   ${r}`));
    }
    
  } else {
    console.log("❌ Folder not found:", SAM_FOLDER);
    const dlFolder = "C:\\Users\\1\\Downloads";
    if (fs.existsSync(dlFolder)) {
      const dirs = fs.readdirSync(dlFolder).filter(d => d.toLowerCase().includes("sam") || d.toLowerCase().includes("edelman"));
      console.log("   Similar folders found:", dirs);
    }
  }
}

main().catch(console.error);
