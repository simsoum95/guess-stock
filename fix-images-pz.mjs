/**
 * Script pour réassocier toutes les images aux produits
 * - Scanne le dossier d'images local
 * - Met l'image PZ en premier (imageUrl)
 * - Ajoute toutes les autres images à la galerie
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMAGES_ROOT = process.env.IMAGES_ROOT;

if (!SUPABASE_URL || !SUPABASE_KEY || !IMAGES_ROOT) {
  console.error("❌ Variables d'environnement manquantes!");
  console.error("   SUPABASE_URL:", SUPABASE_URL ? "OK" : "MANQUANT");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_KEY ? "OK" : "MANQUANT");
  console.error("   IMAGES_ROOT:", IMAGES_ROOT ? "OK" : "MANQUANT");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapping couleurs (abréviations → noms complets)
const colorMapping = {
  'BLA': 'BLACK', 'WHI': 'WHITE', 'BRO': 'BROWN', 'NAV': 'NAVY',
  'GRE': 'GREEN', 'GRA': 'GRAY', 'GREY': 'GRAY', 'RED': 'RED',
  'BLU': 'BLUE', 'PIN': 'PINK', 'PUR': 'PURPLE', 'YEL': 'YELLOW',
  'ORA': 'ORANGE', 'BEI': 'BEIGE', 'CRE': 'CREAM', 'TAN': 'TAN',
  'GOL': 'GOLD', 'SIL': 'SILVER', 'NAT': 'NATURAL', 'IVO': 'IVORY',
  'CAM': 'CAMEL', 'COG': 'COGNAC', 'TAU': 'TAUPE', 'ROS': 'ROSE',
  'CHA': 'CHARCOAL', 'MAR': 'MAROON', 'BUR': 'BURGUNDY',
  'DGR': 'DARK', 'LGR': 'LIGHT', 'MLT': 'MULTI', 'MUL': 'MULTI',
  'CHE': 'CHERRY', 'LAV': 'LAVENDER', 'PEA': 'PEACH', 'COR': 'CORAL',
  'MIN': 'MINT', 'OLI': 'OLIVE', 'RUS': 'RUST', 'SAL': 'SALMON'
};

// Scanner récursivement le dossier d'images
function scanImagesFolder(dir, images = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanImagesFolder(fullPath, images);
    } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
      images.push({ name: entry.name, path: fullPath });
    }
  }
  
  return images;
}

// Extraire modelRef et color du nom de fichier
function parseFilename(filename) {
  // Formats possibles: 
  // MODELREF-COLOR-ANYTHING.jpg
  // MODELREF_COLOR_ANYTHING.jpg
  const base = filename.replace(/\.[^.]+$/, ''); // Enlever extension
  
  // Essayer avec tiret ou underscore
  let parts = base.split('-');
  if (parts.length < 2) {
    parts = base.split('_');
  }
  
  if (parts.length >= 2) {
    const modelRef = parts[0].toUpperCase();
    const colorPart = parts[1].toUpperCase();
    
    // Vérifier si c'est une abréviation de couleur
    const colorAbbrev = colorPart.substring(0, 3);
    const mappedColor = colorMapping[colorAbbrev];
    
    return { 
      modelRef, 
      colorPart,
      colorAbbrev,
      mappedColor,
      endsWithPZ: base.toUpperCase().endsWith('PZ')
    };
  }
  
  return null;
}

// Uploader une image vers Supabase Storage
async function uploadImage(localPath, remoteName) {
  const fileBuffer = fs.readFileSync(localPath);
  const filePath = `products/${remoteName}`;
  
  const { error } = await supabase.storage
    .from('guess-images')
    .upload(filePath, fileBuffer, { 
      upsert: true,
      contentType: 'image/jpeg'
    });
    
  if (error) {
    console.error(`   ❌ Upload échoué: ${error.message}`);
    return null;
  }
  
  const { data } = supabase.storage.from('guess-images').getPublicUrl(filePath);
  return data.publicUrl;
}

async function main() {
  console.log("🔍 Scan du dossier d'images:", IMAGES_ROOT);
  
  // 1. Scanner toutes les images
  const localImages = scanImagesFolder(IMAGES_ROOT);
  console.log(`📁 ${localImages.length} images trouvées\n`);
  
  // 2. Charger tous les produits depuis Supabase
  console.log("📦 Chargement des produits depuis Supabase...");
  const { data: products, error } = await supabase
    .from('products')
    .select('modelRef, color, imageUrl, gallery');
    
  if (error) {
    console.error("❌ Erreur Supabase:", error.message);
    process.exit(1);
  }
  
  console.log(`   ${products.length} produits trouvés\n`);
  
  // 3. Grouper les images par modelRef
  const imagesByModel = {};
  
  for (const img of localImages) {
    const parsed = parseFilename(img.name);
    if (!parsed) continue;
    
    const key = parsed.modelRef;
    if (!imagesByModel[key]) {
      imagesByModel[key] = [];
    }
    imagesByModel[key].push({
      ...img,
      ...parsed
    });
  }
  
  console.log(`📊 ${Object.keys(imagesByModel).length} modelRefs distincts trouvés dans les images\n`);
  
  // 4. Pour chaque produit, trouver ses images
  let updated = 0;
  let noImages = 0;
  
  for (const product of products) {
    const modelRef = (product.modelRef || '').toUpperCase();
    const productColor = (product.color || '').toUpperCase();
    
    // Trouver les images pour ce modelRef
    const modelImages = imagesByModel[modelRef];
    
    if (!modelImages || modelImages.length === 0) {
      noImages++;
      continue;
    }
    
    // Filtrer par couleur (correspondance exacte ou partielle)
    let matchingImages = modelImages.filter(img => {
      // Correspondance exacte
      if (productColor.includes(img.colorPart) || img.colorPart.includes(productColor.split(' ')[0])) {
        return true;
      }
      // Correspondance par mapping
      if (img.mappedColor && productColor.includes(img.mappedColor)) {
        return true;
      }
      // Correspondance par abréviation
      if (productColor.startsWith(img.colorAbbrev)) {
        return true;
      }
      return false;
    });
    
    // Si pas de correspondance couleur, prendre toutes les images du modelRef
    if (matchingImages.length === 0) {
      matchingImages = modelImages;
    }
    
    // Trier: images PZ en premier
    matchingImages.sort((a, b) => {
      if (a.endsWithPZ && !b.endsWithPZ) return -1;
      if (!a.endsWithPZ && b.endsWithPZ) return 1;
      return 0;
    });
    
    // Limiter à 6 images max
    matchingImages = matchingImages.slice(0, 6);
    
    if (matchingImages.length === 0) {
      noImages++;
      continue;
    }
    
    // Uploader les images et récupérer les URLs
    const uploadedUrls = [];
    console.log(`\n📸 ${product.modelRef} (${product.color}): ${matchingImages.length} images`);
    
    for (const img of matchingImages) {
      const remoteName = `${img.modelRef}-${img.colorPart}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.jpg`;
      const url = await uploadImage(img.path, remoteName);
      if (url) {
        uploadedUrls.push(url);
        console.log(`   ✅ ${img.name}${img.endsWithPZ ? ' (PZ - principale)' : ''}`);
      }
    }
    
    if (uploadedUrls.length === 0) continue;
    
    // Mettre à jour le produit dans Supabase
    const imageUrl = uploadedUrls[0]; // Image PZ en premier
    const gallery = uploadedUrls;
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ imageUrl, gallery })
      .eq('modelRef', product.modelRef)
      .eq('color', product.color);
      
    if (updateError) {
      console.log(`   ❌ Erreur mise à jour: ${updateError.message}`);
    } else {
      updated++;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Terminé!`);
  console.log(`   ${updated} produits mis à jour`);
  console.log(`   ${noImages} produits sans images correspondantes`);
}

main().catch(console.error);

