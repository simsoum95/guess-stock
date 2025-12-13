import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as readline from "readline";

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

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resetComplete() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("⚠️  RÉINITIALISATION COMPLÈTE DE LA BASE DE DONNÉES");
  console.log("=".repeat(60));
  console.log();
  console.log("⚠️  ATTENTION: Cette opération va SUPPRIMER TOUS les produits!");
  console.log("   Les images dans Supabase Storage seront CONSERVÉES.");
  console.log();
  console.log("Pour continuer, tapez 'OUI' (en majuscules):");
  console.log();

  try {
    const answer = await askQuestion("Confirmation: ");
    
    if (answer !== "OUI") {
      console.log("❌ Opération annulée.");
      return;
    }

    console.log();
    console.log("📊 Vérification de l'état actuel...");
    
    // Compter les produits
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    console.log(`   Produits actuels: ${count || 0}`);
    console.log();

    if (count === 0) {
      console.log("✅ La base est déjà vide. Rien à faire.");
      return;
    }

    console.log("🗑️  Suppression de tous les produits...");
    
    // Supprimer tous les produits (utiliser une condition toujours vraie)
    const { error: deleteError, count: deletedCount } = await supabase
      .from("products")
      .delete()
      .neq("id", "NEVER_DELETE_THIS_FAKE_ID_FOR_DELETE_ALL");

    if (deleteError) {
      console.error("❌ Erreur lors de la suppression:", deleteError.message);
      return;
    }

    console.log(`✅ ${count || 0} produits supprimés`);
    console.log();
    console.log("=".repeat(60));
    console.log("✅ RÉINITIALISATION TERMINÉE");
    console.log("=".repeat(60));
    console.log();
    console.log("💡 Vous pouvez maintenant importer un nouveau fichier Excel");
    console.log("   avec les bonnes données depuis le début.");
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

resetComplete().catch(console.error);


