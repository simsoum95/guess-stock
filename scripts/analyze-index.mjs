#!/usr/bin/env node
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
  console.log('ANALYSE DES IMAGES DANS INDEX\n');
  
  // Get all images from index
  let allImages = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('image_index')
      .select('model_ref, color, filename')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allImages.push(...data);
    offset += 1000;
  }
  
  console.log('Total images dans index:', allImages.length);
  
  // Group by modelRef
  const byModel = new Map();
  allImages.forEach(img => {
    const key = img.model_ref.toUpperCase();
    if (!byModel.has(key)) byModel.set(key, new Set());
    byModel.get(key).add(img.color);
  });
  
  console.log('ModelRefs uniques:', byModel.size);
  
  // Show distribution by prefix
  const byPrefix = {};
  for (const [model] of byModel) {
    const prefix = model.substring(0, 2);
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  
  console.log('\nDistribution par prefix:');
  Object.entries(byPrefix)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([prefix, count]) => console.log(`  ${prefix}: ${count} produits`));
  
  // List GW models
  console.log('\nExemples GW - premiers 30:');
  const gwModels = Array.from(byModel.keys()).filter(m => m.startsWith('GW')).slice(0, 30);
  gwModels.forEach(m => {
    const colors = Array.from(byModel.get(m));
    console.log(`  ${m}: ${colors.join(', ')}`);
  });
  
  // List all model refs for products that might not have images on site
  console.log('\nTOUS LES MODELREFS DISPONIBLES:');
  const allModels = Array.from(byModel.keys()).sort();
  console.log(`Total: ${allModels.length} modelRefs uniques`);
  console.log('Exemples:', allModels.slice(0, 50).join(', '));
}

analyze();

