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
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY:", SUPABASE_KEY ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔄 RÉINITIALISATION DU STOCK DANS SUPABASE");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. Compter les produits avec stock > 0
    console.log("📊 Vérification du stock actuel...");
    const { data: productsWithStock, error: countError } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity")
      .gt("stockQuantity", 0);

    if (countError) {
      console.error("❌ Erreur lors de la vérification:", countError.message);
      process.exit(1);
    }

    const count = productsWithStock?.length || 0;
    console.log(`   Trouvé ${count} produits avec stock > 0`);
    console.log();

    if (count === 0) {
      console.log("✅ Tous les produits ont déjà un stock de 0. Rien à faire.");
      return;
    }

    // 2. Afficher un aperçu
    console.log("📋 Aperçu des produits qui seront mis à 0:");
    if (productsWithStock && productsWithStock.length > 0) {
      productsWithStock.slice(0, 10).forEach((p) => {
        console.log(`   - ${p.modelRef} / ${p.color}: ${p.stockQuantity} → 0`);
      });
      if (productsWithStock.length > 10) {
        console.log(`   ... et ${productsWithStock.length - 10} autres produits`);
      }
    }
    console.log();

    // 3. Demander confirmation (simulée - en production, vous pourriez ajouter un prompt)
    console.log("⚠️  ATTENTION: Cette opération va mettre TOUS les stocks à 0!");
    console.log("   Les images et autres informations seront conservées.");
    console.log();

    // 4. Mettre tous les stocks à 0
    console.log("🔄 Mise à jour en cours...");
    const { data, error } = await supabase
      .from("products")
      .update({ stockQuantity: 0 })
      .gt("stockQuantity", 0)
      .select("id");

    if (error) {
      console.error("❌ Erreur lors de la mise à jour:", error.message);
      process.exit(1);
    }

    const updatedCount = data?.length || 0;
    console.log();
    console.log("=".repeat(60));
    console.log(`✅ SUCCÈS: ${updatedCount} produits mis à stock 0`);
    console.log("=".repeat(60));
    console.log();
    console.log("💡 Vous pouvez maintenant uploader un nouveau fichier Excel");
    console.log("   pour réinitialiser les stocks avec les bonnes valeurs.");
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  }
}

main().catch(console.error);




