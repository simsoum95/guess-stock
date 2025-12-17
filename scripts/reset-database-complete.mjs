import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables d'environnement manquantes!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetDatabase() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("⚠️  RÉINITIALISATION COMPLÈTE DE LA BASE DE DONNÉES");
  console.log("=".repeat(60));
  console.log();
  console.log("⚠️  ATTENTION: Cette opération va SUPPRIMER TOUS les produits!");
  console.log("   Les images dans Supabase Storage seront conservées.");
  console.log();
  console.log("Pour continuer, tapez 'OUI' (en majuscules):");
  console.log();

  // Dans un vrai script, on pourrait utiliser readline pour demander confirmation
  // Pour l'instant, on va juste afficher un avertissement
  console.log("⚠️  Pour des raisons de sécurité, cette opération doit être confirmée manuellement.");
  console.log("   Modifiez ce script pour décommenter la ligne de suppression.");
  console.log();

  try {
    // Compter les produits actuels
    const { data: products, error: countError } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    if (countError) {
      console.error("❌ Erreur:", countError.message);
      return;
    }

    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    console.log(`📊 Produits actuels dans la base: ${count || 0}`);
    console.log();

    // DÉCOMMENTER CETTE LIGNE POUR VRAIMENT SUPPRIMER
    // const { error: deleteError } = await supabase.from("products").delete().neq("id", "NEVER_DELETE_THIS");

    console.log("💡 Pour supprimer tous les produits:");
    console.log("   1. Ouvrez ce script (scripts/reset-database-complete.mjs)");
    console.log("   2. Décommentez la ligne de suppression");
    console.log("   3. Relancez le script");
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

resetDatabase().catch(console.error);




