/**
 * Script pour créer un index des images dans Supabase
 * Cet index permet de trouver les images instantanément
 * 
 * Usage: node scripts/create-image-index.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY non défini!");
  console.log("\nExécutez avec:");
  console.log('$env:SUPABASE_SERVICE_ROLE_KEY="votre_clé"; node scripts/create-image-index.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("🔧 Création de l'index des images...\n");

  // 1. Créer la table si elle n'existe pas
  console.log("1️⃣ Création de la table image_index...");
  
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.image_index (
        id SERIAL PRIMARY KEY,
        model_ref VARCHAR(50) NOT NULL,
        color VARCHAR(50) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(filename)
      );
      
      CREATE INDEX IF NOT EXISTS idx_image_index_model_ref ON public.image_index(model_ref);
      CREATE INDEX IF NOT EXISTS idx_image_index_model_color ON public.image_index(model_ref, color);
    `
  });

  if (createError) {
    console.log("⚠️ Table creation via RPC failed, trying direct approach...");
    // La table existe peut-être déjà, continuons
  }

  // 2. Lister toutes les images avec pagination
  console.log("\n2️⃣ Récupération de toutes les images...");
  
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  const allImages = [];
  
  while (hasMore) {
    const { data: items, error } = await supabase.storage
      .from("guess-images")
      .list("products", {
        limit: BATCH_SIZE,
        offset: offset,
        sortBy: { column: "name", order: "asc" }
      });
    
    if (error) {
      console.error(`❌ Erreur à l'offset ${offset}:`, error.message);
      break;
    }
    
    if (!items || items.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of items) {
      if (item.name.includes(".")) {
        allImages.push(item.name);
      }
    }
    
    console.log(`   ${allImages.length} images chargées...`);
    
    if (items.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      offset += BATCH_SIZE;
    }
  }
  
  console.log(`\n✅ ${allImages.length} images trouvées au total`);

  // 3. Parser et indexer
  console.log("\n3️⃣ Parsing et indexation des images...");
  
  const records = [];
  
  for (const filename of allImages) {
    const parsed = parseFilename(filename);
    if (!parsed) continue;
    
    const { data: urlData } = supabase.storage
      .from("guess-images")
      .getPublicUrl(`products/${filename}`);
    
    records.push({
      model_ref: parsed.modelRef,
      color: parsed.color,
      filename: filename,
      url: urlData.publicUrl
    });
  }
  
  console.log(`   ${records.length} images parsées avec succès`);

  // 4. Insérer dans la table (par batch de 500)
  console.log("\n4️⃣ Insertion dans la table image_index...");
  
  // D'abord, vider la table
  const { error: deleteError } = await supabase
    .from('image_index')
    .delete()
    .neq('id', 0);
  
  if (deleteError) {
    console.log("⚠️ Erreur lors du vidage:", deleteError.message);
  }
  
  const BATCH_INSERT = 500;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += BATCH_INSERT) {
    const batch = records.slice(i, i + BATCH_INSERT);
    
    const { error: insertError } = await supabase
      .from('image_index')
      .upsert(batch, { onConflict: 'filename' });
    
    if (insertError) {
      console.error(`❌ Erreur insertion batch ${i}:`, insertError.message);
    } else {
      inserted += batch.length;
      console.log(`   ${inserted}/${records.length} insérées...`);
    }
  }
  
  console.log(`\n✅ Index créé avec succès! ${inserted} images indexées.`);
  
  // 5. Afficher quelques stats
  const { data: stats } = await supabase
    .from('image_index')
    .select('model_ref')
    .limit(1);
  
  const { count } = await supabase
    .from('image_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Statistiques:`);
  console.log(`   - ${count} images dans l'index`);
  console.log(`   - Prêt pour une recherche instantanée!`);
}

function parseFilename(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  
  // Format: MODELREF-COLOR-... ou MODELREF_COLOR_...
  let parts;
  
  if (baseName.includes("-")) {
    parts = baseName.split("-");
  } else if (baseName.includes("_")) {
    parts = baseName.split("_");
  } else {
    return null;
  }
  
  if (parts.length >= 2) {
    return {
      modelRef: parts[0].trim().toUpperCase(),
      color: parts[1].trim().toUpperCase()
    };
  }
  
  return null;
}

main().catch(console.error);

