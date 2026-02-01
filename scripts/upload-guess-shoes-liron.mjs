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
  
  const { data, error } = await supabase
    .from("image_index")
    .select("model_ref, color, filename");
  
  if (error) {
    console.error("Erreur lors de la récupération des images:", error);
    return new Set();
  }
  
  // Create a set of existing model_ref + color combinations
  const existing = new Set();
  data.forEach(img => {
    const key = `${img.model_ref}_${img.color}`.toUpperCase();
    existing.add(key);
    // Also add the filename without extension
    if (img.filename) {
      existing.add(img.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toUpperCase());
    }
  });
  
  console.log(`   ${existing.size} combinaisons model_ref+color existantes`);
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
  // First check if already exists
  const { data: existing } = await supabase
    .from("image_index")
    .select("id")
    .eq("model_ref", modelRef.toUpperCase())
    .eq("color", color.toUpperCase())
    .single();
  
  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from("image_index")
      .update({ filename, url })
      .eq("model_ref", modelRef.toUpperCase())
      .eq("color", color.toUpperCase());
    
    if (error) throw error;
  } else {
    // Insert new record
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
  
  // Group images by model_ref + color (we only need one image per combination)
  const imageGroups = new Map();
  
  files.forEach(filename => {
    const parsed = parseFilename(filename);
    if (parsed) {
      const key = `${parsed.modelRef}_${parsed.color}`.toUpperCase();
      
      // Only keep one image per model_ref + color (prefer non-CP views as CP is often a small thumbnail)
      if (!imageGroups.has(key)) {
        imageGroups.set(key, { filename, ...parsed });
      } else if (parsed.viewType !== "CP" && imageGroups.get(key).viewType === "CP") {
        // Replace CP with a better view
        imageGroups.set(key, { filename, ...parsed });
      }
    }
  });
  
  console.log(`📦 ${imageGroups.size} combinaisons uniques model_ref+color\n`);
  
  // Filter out already existing images
  const toUpload = [];
  for (const [key, data] of imageGroups) {
    if (!existingImages.has(key)) {
      toUpload.push(data);
    }
  }
  
  console.log(`🆕 ${toUpload.length} nouvelles images à uploader`);
  console.log(`⏭️  ${imageGroups.size - toUpload.length} images déjà existantes (ignorées)\n`);
  
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

