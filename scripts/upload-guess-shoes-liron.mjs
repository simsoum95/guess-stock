import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SOURCE_FOLDER = "C:\\Users\\1\\Downloads\\guess chaussure liron";
const BUCKET_NAME = "guess-images";
const STORAGE_FOLDER = "products";

// Parse filename to extract model_ref and color
// Format: MODELREF_COLOR_VIEWTYPE.jpg (e.g., GWAISHA_BLK01_BZ.jpg)
function parseFilename(filename) {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const parts = nameWithoutExt.split("_");
  
  if (parts.length >= 2) {
    const modelRef = parts[0]; // e.g., GWAISHA
    const color = parts[1]; // e.g., BLK01
    const viewType = parts[2] || ""; // e.g., BZ
    return { modelRef, color, viewType };
  }
  return null;
}

async function getExistingImages() {
  console.log("📊 Récupération des images existantes...");
  
  // Paginate to get ALL existing images
  let allData = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("image_index")
      .select("filename")
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error("Erreur lors de la récupération des images:", error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      offset += pageSize;
      if (data.length < pageSize) hasMore = false;
    }
  }
  
  // Track by filename (each view is a separate entry)
  const existing = new Set();
  allData.forEach(img => {
    if (img.filename) {
      existing.add(img.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase());
    }
  });
  
  console.log(`   ${existing.size} images existantes dans l'index`);
  return existing;
}

async function uploadImage(filePath, filename) {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${STORAGE_FOLDER}/${filename}`;
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true, // Overwrite if exists
    });
  
  if (error && !error.message.includes("already exists")) {
    throw error;
  }
  
  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  
  return urlData.publicUrl;
}

async function indexImage(modelRef, color, filename, url) {
  // Use filename as unique key - each view (PZ, BZ, OZ, etc.) gets its own row
  const { data: existing } = await supabase
    .from("image_index")
    .select("id")
    .eq("filename", filename)
    .single();
  
  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from("image_index")
      .update({ 
        model_ref: modelRef.toUpperCase(), 
        color: color.toUpperCase(), 
        url 
      })
      .eq("filename", filename);
    
    if (error) throw error;
  } else {
    // Insert new record - one per view/filename
    const { error } = await supabase
      .from("image_index")
      .insert({
        model_ref: modelRef.toUpperCase(),
        color: color.toUpperCase(),
        filename: filename,
        url: url,
      });
    
    if (error) throw error;
  }
}

async function main() {
  console.log("🚀 Démarrage de l'upload des images GUESS Shoes...\n");
  
  // Get list of files
  const files = fs.readdirSync(SOURCE_FOLDER)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  
  console.log(`📁 ${files.length} fichiers image trouvés dans le dossier\n`);
  
  // Get existing images
  const existingImages = await getExistingImages();
  
  // Upload ALL views for each product (PZ, BZ, OZ, RZ, TZ, XZ)
  // Skip CP (tiny thumbnail) to save space
  const toUpload = [];
  let skippedCount = 0;
  
  files.forEach(filename => {
    const parsed = parseFilename(filename);
    if (parsed) {
      // Skip CP thumbnails (very small, not useful)
      if (parsed.viewType === "CP") return;
      
      // Check if this exact filename already exists
      const filenameKey = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase();
      if (!existingImages.has(filenameKey)) {
        toUpload.push({ filename, ...parsed });
      } else {
        skippedCount++;
      }
    }
  });
  
  console.log(`🆕 ${toUpload.length} nouvelles images à uploader`);
  console.log(`⏭️  ${skippedCount} images déjà existantes (ignorées)\n`);
  
  if (toUpload.length === 0) {
    console.log("✅ Toutes les images sont déjà dans la base de données!");
    return;
  }
  
  // Upload new images
  let uploaded = 0;
  let errors = 0;
  
  for (const data of toUpload) {
    const { filename, modelRef, color } = data;
    const filePath = path.join(SOURCE_FOLDER, filename);
    
    try {
      const url = await uploadImage(filePath, filename);
      await indexImage(modelRef, color, filename, url);
      uploaded++;
      
      if (uploaded % 50 === 0) {
        console.log(`   ✅ ${uploaded}/${toUpload.length} uploadées...`);
      }
    } catch (err) {
      errors++;
      console.error(`   ❌ Erreur pour ${filename}:`, err.message);
    }
  }
  
  console.log(`\n🎉 Upload terminé!`);
  console.log(`   ✅ ${uploaded} images uploadées avec succès`);
  console.log(`   ❌ ${errors} erreurs`);
}

main().catch(console.error);

