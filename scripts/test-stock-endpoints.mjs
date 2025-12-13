import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables d'environnement manquantes!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testStockOperations() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🧪 TEST DES OPÉRATIONS DE STOCK");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. Vérifier qu'on peut lire les produits
    console.log("1️⃣  Test de lecture des produits...");
    const { data: products, error: readError } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity")
      .limit(5);

    if (readError) {
      console.error("   ❌ Erreur:", readError.message);
      return false;
    }

    console.log(`   ✅ ${products?.length || 0} produits lus avec succès`);
    if (products && products.length > 0) {
      console.log(`   Exemple: ${products[0].modelRef} / ${products[0].color} - Stock: ${products[0].stockQuantity}`);
    }
    console.log();

    // 2. Vérifier qu'on peut mettre à jour un stock (test avec le premier produit)
    if (products && products.length > 0) {
      const testProduct = products[0];
      const originalStock = testProduct.stockQuantity || 0;
      const testStock = 999;

      console.log("2️⃣  Test de mise à jour du stock...");
      console.log(`   Produit test: ${testProduct.modelRef} / ${testProduct.color}`);
      console.log(`   Stock actuel: ${originalStock} → Test: ${testStock}`);

      const { error: updateError } = await supabase
        .from("products")
        .update({ stockQuantity: testStock })
        .eq("id", testProduct.id);

      if (updateError) {
        console.error("   ❌ Erreur:", updateError.message);
        return false;
      }

      console.log("   ✅ Mise à jour réussie");

      // Remettre le stock original
      await supabase
        .from("products")
        .update({ stockQuantity: originalStock })
        .eq("id", testProduct.id);

      console.log(`   ✅ Stock remis à ${originalStock}`);
      console.log();
    }

    // 3. Vérifier les statistiques de stock
    console.log("3️⃣  Statistiques du stock...");
    const { data: allProducts, error: statsError } = await supabase
      .from("products")
      .select("stockQuantity");

    if (statsError) {
      console.error("   ❌ Erreur:", statsError.message);
      return false;
    }

    const total = allProducts?.length || 0;
    const withStock = allProducts?.filter(p => (p.stockQuantity || 0) > 0).length || 0;
    const zeroStock = total - withStock;

    console.log(`   Total produits: ${total}`);
    console.log(`   Avec stock > 0: ${withStock}`);
    console.log(`   Stock à 0: ${zeroStock}`);
    console.log();

    console.log("=".repeat(60));
    console.log("✅ TOUS LES TESTS SONT PASSÉS!");
    console.log("=".repeat(60));
    console.log();
    console.log("💡 Vous pouvez maintenant uploader votre fichier Excel");
    console.log("   sur /admin/upload pour mettre à jour les stocks.");
    console.log();

    return true;

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
    return false;
  }
}

testStockOperations().catch(console.error);


