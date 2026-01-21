import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  console.log('=== ANALYSE DES IMAGES ===\n');
  
  // Get sample of filenames from image_index
  const { data: oldest, error } = await supabase
    .from('image_index')
    .select('filename, model_ref, created_at')
    .order('created_at', { ascending: true })
    .limit(30);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('=== 30 PREMIERES IMAGES (les plus anciennes) ===');
  oldest.forEach((img, i) => {
    console.log(`${i+1}. ${img.filename} | ${img.created_at?.substring(0,10) || 'N/A'}`);
  });
  
  // Get latest images
  const { data: latest } = await supabase
    .from('image_index')
    .select('filename, model_ref, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  
  console.log('\n=== 30 DERNIERES IMAGES (les plus recentes) ===');
  latest?.forEach((img, i) => {
    console.log(`${i+1}. ${img.filename} | ${img.created_at?.substring(0,10) || 'N/A'}`);
  });
  
  // Count total
  const { count: total } = await supabase
    .from('image_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total images dans index: ${total}`);
  
  // List files in storage
  console.log('\n=== FICHIERS DANS STORAGE (products/) ===');
  const { data: files, error: storageError } = await supabase.storage
    .from('guess-images')
    .list('products', { limit: 50, sortBy: { column: 'name', order: 'asc' } });
  
  if (files) {
    console.log(`${files.length} premiers fichiers:`);
    files.slice(0, 20).forEach((f, i) => {
      console.log(`${i+1}. ${f.name}`);
    });
  }
}

analyze();

