import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restore() {
  console.log("🔄 RESTAURATION DES DONNÉES DEPUIS products.json...\n");

  // Lire le fichier JSON
  const jsonPath = path.join(process.cwd(), "data", "products.json");
  const jsonContent = fs.readFileSync(jsonPath, "utf-8");
  const products = JSON.parse(jsonContent);

  console.log(`📦 ${products.length} produits à restaurer\n`);

  let restored = 0;
  let errors = 0;

  for (const product of products) {
    // Mettre à jour chaque produit
    const { error } = await supabase
      .from("products")
      .update({
        stockQuantity: product.stockQuantity,
        priceRetail: product.priceRetail,
        priceWholesale: product.priceWholesale,
      })
      .eq("modelRef", product.modelRef)
      .eq("color", product.color);

    if (error) {
      console.log(`❌ Erreur: ${product.modelRef} - ${error.message}`);
      errors++;
    } else {
      restored++;
      if (restored % 100 === 0) {
        console.log(`✅ ${restored} produits restaurés...`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ RESTAURATION TERMINÉE`);
  console.log(`   - Restaurés: ${restored}`);
  console.log(`   - Erreurs: ${errors}`);
  console.log(`========================================\n`);
}

restore().catch(console.error);

