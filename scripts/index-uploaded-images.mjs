#!/usr/bin/env node
/**
 * Index images that were uploaded to Supabase Storage but not indexed
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'guess-images';

async function main() {
  console.log('═'.repeat(60));
  console.log('  INDEXATION DES IMAGES UPLOADÉES');
  console.log('═'.repeat(60));
  console.log('');

  // List all files in products/ folder
  let allFiles = [];
  let offset = 0;
  const limit = 1000;
  
  console.log('📁 Récupération des fichiers dans Storage...');
  
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('products', { limit, offset });
    
    if (error) {
      console.error('❌ Error listing files:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allFiles.push(...data.filter(f => f.name && f.name.includes('.')));
    offset += limit;
    
    console.log(`   Chargé ${allFiles.length} fichiers...`);
  }
  
  console.log(`\n📁 Total fichiers dans Storage: ${allFiles.length}`);
  
  // Get existing indexed files
  console.log('\n📝 Récupération des fichiers déjà indexés...');
  const { data: existingIndex } = await supabase
    .from('image_index')
    .select('filename');
  
  const existingFilenames = new Set((existingIndex || []).map(i => i.filename));
  console.log(`   Déjà indexés: ${existingFilenames.size}`);
  
  // Filter new files to index
  const newFiles = allFiles.filter(f => !existingFilenames.has(f.name));
  console.log(`   Nouveaux à indexer: ${newFiles.length}`);
  
  if (newFiles.length === 0) {
    console.log('\n✅ Toutes les images sont déjà indexées !');
    return;
  }
  
  // Index new files
  console.log('\n📤 Indexation en cours...');
  
  let indexed = 0;
  let errors = 0;
  const batchSize = 500;
  
  for (let i = 0; i < newFiles.length; i += batchSize) {
    const batch = newFiles.slice(i, i + batchSize);
    const records = [];
    
    for (const file of batch) {
      // Parse filename: MODELREF-COLOR-originalname.jpg
      const parts = file.name.split('-');
      if (parts.length >= 2) {
        const modelRef = parts[0].toUpperCase();
        const colorCode = parts[1].toUpperCase();
        
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`products/${file.name}`);
        
        records.push({
          model_ref: modelRef,
          color: colorCode,
          filename: file.name,
          url: urlData.publicUrl
        });
      }
    }
    
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('image_index')
        .upsert(records, { onConflict: 'filename' });
      
      if (insertError) {
        console.error(`   ❌ Batch error:`, insertError.message);
        errors += records.length;
      } else {
        indexed += records.length;
      }
    }
    
    console.log(`   Progression: ${Math.min(i + batchSize, newFiles.length)}/${newFiles.length} (${indexed} indexés, ${errors} erreurs)`);
  }
  
  console.log('');
  console.log('═'.repeat(60));
  console.log('  RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`📁 Total dans Storage:  ${allFiles.length}`);
  console.log(`📝 Déjà indexés:        ${existingFilenames.size}`);
  console.log(`✅ Nouveaux indexés:    ${indexed}`);
  console.log(`❌ Erreurs:             ${errors}`);
  console.log('═'.repeat(60));
  console.log('');
  console.log('✅ Indexation terminée !');
}

main().catch(console.error);

