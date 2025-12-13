import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icpedcfdavwyvkuipqiz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDatabase() {
  console.log('🔍 Vérification de la base de données Supabase...\n');

  // Essayer de lire la table products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, modelRef, imageUrl, image_url, productName')
    .limit(10);

  if (productsError) {
    console.log('⚠️ Table "products":', productsError.message);
  } else {
    console.log('✅ Table "products" trouvée!');
    console.log(`📦 ${products.length} premiers produits:`);
    products.forEach(p => {
      console.log(`   - ${p.modelRef || p.id}: ${p.imageUrl || p.image_url || 'pas d\'image'}`);
    });
  }

  // Essayer d'autres noms de tables possibles
  const tableNames = ['product', 'items', 'catalog', 'inventory'];
  for (const tableName of tableNames) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (!error) {
      console.log(`\n✅ Table "${tableName}" existe aussi!`);
      if (data && data.length > 0) {
        console.log('   Colonnes:', Object.keys(data[0]));
      }
    }
  }
}

checkDatabase().catch(console.error);






