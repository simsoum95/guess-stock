import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://icpedcfdavwyvkuipqiz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcGVkY2ZkYXZ3eXZrdWlwcWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTI0ODQsImV4cCI6MjA4MDkyODQ4NH0.3Ajcv9avpVtpOCTgvDk8O3P_SnjBwxiZEwmlbm0Jihk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Lire les produits depuis le fichier JSON
  const productsPath = path.join(process.cwd(), "data", "products.json");
  const rawData = fs.readFileSync(productsPath, "utf-8");
  const products = JSON.parse(rawData);

  console.log(`📦 ${products.length} produits à importer...`);

  // Insérer par lots de 100 pour éviter les timeouts
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    // Utiliser les noms de colonnes camelCase (comme dans la table Supabase)
    const formattedBatch = batch.map((p, idx) => ({
      id: p.id || `product-${i + idx}`,
      collection: p.collection || "",
      category: p.category || "",
      subcategory: p.subcategory || "",
      brand: p.brand || "",
      modelRef: p.modelRef || "",
      gender: p.gender || "",
      supplier: p.supplier || "",
      color: p.color || "",
      priceRetail: p.priceRetail || 0,
      priceWholesale: p.priceWholesale || 0,
      stockQuantity: p.stockQuantity || 0,
      imageUrl: p.imageUrl || "/images/default.png",
      gallery: p.gallery || [],
      productName: p.productName || "",
      size: p.size || ""
    }));

    const { error } = await supabase
      .from("products")
      .insert(formattedBatch);

    if (error) {
      console.error(`❌ Erreur lot ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ Lot ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} produits insérés`);
    }
  }

  console.log(`\n📊 Résumé:`);
  console.log(`   - Insérés: ${inserted}`);
  console.log(`   - Erreurs: ${errors}`);
}

main().catch(console.error);
