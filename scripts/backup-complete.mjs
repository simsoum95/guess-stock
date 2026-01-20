import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "fs";

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

async function backupComplete() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("💾 SAUVEGARDE COMPLÈTE");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. Sauvegarder tous les produits
    console.log("📦 Sauvegarde des produits...");
    const { data: products, error } = await supabase
      .from("products")
      .select("*");

    if (error) {
      console.error("❌ Erreur:", error.message);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = join(__dirname, "..", "data", "backups");
    
    // Créer le dossier backups s'il n'existe pas
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = join(backupDir, `products-backup-complete-${timestamp}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify(products, null, 2), "utf-8");
    
    console.log(`✅ ${products?.length || 0} produits sauvegardés dans: ${backupPath}`);
    console.log();

    // 2. Statistiques
    const stats = {
      total: products?.length || 0,
      withImages: products?.filter(p => p.imageUrl && !p.imageUrl.includes("default")).length || 0,
      withStock: products?.filter(p => (p.stockQuantity || 0) > 0).length || 0,
      categories: {},
    };

    products?.forEach(p => {
      const cat = p.subcategory || "אחר";
      stats.categories[cat] = (stats.categories[cat] || 0) + 1;
    });

    console.log("📊 Statistiques de la sauvegarde:");
    console.log(`   Total produits: ${stats.total}`);
    console.log(`   Avec images: ${stats.withImages}`);
    console.log(`   Avec stock > 0: ${stats.withStock}`);
    console.log();

    console.log("✅ Sauvegarde complète terminée!");
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

backupComplete().catch(console.error);








