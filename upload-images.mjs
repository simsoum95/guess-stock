/**
 * Script pour uploader toutes les images vers Supabase Storage
 * Usage: node upload-images.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration
const IMAGES_FOLDER = "C:\\Users\\1\\Desktop\\new image guess";
const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extensions d'images supportées
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

async function main() {
  console.log("🖼️  Upload des images vers Supabase Storage\n");
  console.log(`📁 Dossier source: ${IMAGES_FOLDER}`);
  
  if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY non défini!");
    console.log("\nExécutez avec:");
    console.log('$env:SUPABASE_SERVICE_ROLE_KEY="votre_clé"; node upload-images.mjs');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Vérifier que le dossier existe
  if (!fs.existsSync(IMAGES_FOLDER)) {
    console.error(`❌ Dossier non trouvé: ${IMAGES_FOLDER}`);
    return;
  }

  // Lister toutes les images (récursivement)
  const allImages = [];
  
  function scanFolder(folderPath, relativePath = "") {
    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const relPath = relativePath ? `${relativePath}/${item}` : item;
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanFolder(fullPath, relPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          allImages.push({
            fullPath,
            fileName: item,
            relativePath: relPath
          });
        }
      }
    }
  }
  
  scanFolder(IMAGES_FOLDER);
  
  console.log(`\n📷 ${allImages.length} images trouvées\n`);
  
  if (allImages.length === 0) {
    console.log("Aucune image à uploader.");
    return;
  }

  // Upload chaque image
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < allImages.length; i++) {
    const img = allImages[i];
    const storagePath = `products/${img.fileName}`;
    
    // Afficher progression
    process.stdout.write(`\r[${i + 1}/${allImages.length}] ${img.fileName.substring(0, 40)}...`);
    
    try {
      // Lire le fichier
      const fileBuffer = fs.readFileSync(img.fullPath);
      
      // Déterminer le type MIME
      const ext = path.extname(img.fileName).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      const contentType = mimeTypes[ext] || 'image/jpeg';
      
      // Upload (upsert pour écraser si existe)
      const { error } = await supabase.storage
        .from('guess-images')
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true
        });
      
      if (error) {
        if (error.message.includes('already exists')) {
          skipped++;
        } else {
          console.log(`\n❌ Erreur ${img.fileName}: ${error.message}`);
          errors++;
        }
      } else {
        uploaded++;
      }
    } catch (err) {
      console.log(`\n❌ Exception ${img.fileName}: ${err.message}`);
      errors++;
    }
  }
  
  console.log("\n\n✅ Upload terminé!");
  console.log(`   📤 Uploadés: ${uploaded}`);
  console.log(`   ⏭️  Ignorés (déjà existants): ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);
}

main().catch(console.error);
