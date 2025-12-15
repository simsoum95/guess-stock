/**
 * Script pour créer la table image_index et la peupler
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY non défini!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function main() {
  console.log("🔧 Setup de l'index des images...\n");

  // 1. Créer la table via SQL
  console.log("1️⃣ Création de la table...");
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS image_index (
      id SERIAL PRIMARY KEY,
      model_ref VARCHAR(50) NOT NULL,
      color VARCHAR(100) NOT NULL,
      filename VARCHAR(500) NOT NULL UNIQUE,
      url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_image_model_ref ON image_index(model_ref);
    CREATE INDEX IF NOT EXISTS idx_image_model_color ON image_index(model_ref, color);
  `;
  
  // Use REST API to execute SQL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ sql: createTableSQL })
  });
  
  if (!response.ok) {
    console.log("   Table création via RPC non disponible, table probablement déjà créée.");
  } else {
    console.log("   ✅ Table créée!");
  }
  
  console.log("   Continuation avec la population de l'index...");

  // 2. Lister et insérer les images
  await populateIndex();
}

async function populateIndex() {
  console.log("\n2️⃣ Récupération des images...");
  
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
    
    if (error || !items || items.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of items) {
      if (item.name.includes(".")) {
        allImages.push(item.name);
      }
    }
    
    process.stdout.write(`\r   ${allImages.length} images chargées...`);
    
    if (items.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      offset += BATCH_SIZE;
    }
  }
  
  console.log(`\n   ✅ ${allImages.length} images trouvées`);

  // 3. Parser et préparer les données
  console.log("\n3️⃣ Parsing des images...");
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
  
  console.log(`   ✅ ${records.length} images parsées`);

  // 4. Vider et insérer
  console.log("\n4️⃣ Insertion dans la base...");
  
  // Vider
  await supabase.from('image_index').delete().neq('id', 0);
  
  // Insérer par batch
  const BATCH_INSERT = 500;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += BATCH_INSERT) {
    const batch = records.slice(i, i + BATCH_INSERT);
    
    const { error } = await supabase
      .from('image_index')
      .insert(batch);
    
    if (error) {
      console.error(`\n   ❌ Batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   ${inserted}/${records.length} insérées...`);
    }
  }
  
  console.log(`\n\n✅ Terminé! ${inserted} images dans l'index.`);
}

function parseFilename(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  
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

