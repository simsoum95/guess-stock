import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icpedcfdavwyvkuipqiz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixImages() {
  console.log('🔍 Connexion à Supabase Storage...\n');

  // Lister les buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('❌ Erreur:', bucketsError.message);
    return;
  }

  console.log('📦 Buckets disponibles:');
  buckets.forEach(b => console.log(`   - ${b.name}`));
  console.log('');

  // Chercher le bucket d'images (probablement "images" ou "products" ou "product-images")
  const imageBucket = buckets.find(b => 
    b.name.includes('image') || b.name.includes('product') || b.name === 'images'
  );

  if (!imageBucket) {
    console.log('⚠️ Aucun bucket d\'images trouvé. Buckets existants:', buckets.map(b => b.name));
    
    // Essayons de lister les fichiers dans chaque bucket
    for (const bucket of buckets) {
      console.log(`\n📂 Contenu du bucket "${bucket.name}":`);
      const { data: files } = await supabase.storage.from(bucket.name).list('', { limit: 10 });
      if (files && files.length > 0) {
        files.forEach(f => console.log(`   - ${f.name}`));
      } else {
        console.log('   (vide)');
      }
    }
    return;
  }

  console.log(`✅ Bucket d'images trouvé: ${imageBucket.name}\n`);

  // Lister les images
  const { data: images, error: imagesError } = await supabase.storage
    .from(imageBucket.name)
    .list('', { limit: 1000 });

  if (imagesError) {
    console.error('❌ Erreur:', imagesError.message);
    return;
  }

  console.log(`📸 ${images.length} images trouvées dans le bucket\n`);

  // Créer un map des images par modelRef
  const imageMap = new Map();
  for (const img of images) {
    if (img.name && !img.name.startsWith('.')) {
      // Extraire le modelRef du nom de fichier (ex: AA947142.jpg -> AA947142)
      const modelRef = img.name.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').toUpperCase();
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${imageBucket.name}/${img.name}`;
      imageMap.set(modelRef, publicUrl);
    }
  }

  console.log(`🔗 ${imageMap.size} images mappées par modelRef\n`);

  // Charger products.json
  const productsPath = path.join(process.cwd(), 'data', 'products.json');
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

  let updated = 0;
  let notFound = 0;

  for (const product of products) {
    const modelRef = product.modelRef?.toUpperCase();
    if (modelRef && imageMap.has(modelRef)) {
      product.imageUrl = imageMap.get(modelRef);
      updated++;
    } else if (product.imageUrl === '/images/default.png') {
      notFound++;
    }
  }

  // Sauvegarder
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 4), 'utf-8');

  console.log(`✅ ${updated} produits mis à jour avec leurs images`);
  console.log(`⚠️ ${notFound} produits sans image trouvée`);
  console.log('\n✅ Terminé!');
}

fixImages().catch(console.error);







