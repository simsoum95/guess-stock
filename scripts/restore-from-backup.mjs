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

async function restoreFromBackup() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔄 RESTAURATION DEPUIS LE BACKUP");
  console.log("=".repeat(60));
  console.log();

  try {
    // Charger le backup
    const backupPath = join(__dirname, "..", "data", "backups", "products-backup-2025-12-12T10-01-35-182Z.json");
    
    if (!fs.existsSync(backupPath)) {
      console.error("❌ Backup non trouvé!");
      return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    console.log(`📦 Backup chargé: ${backupData.length} produits`);
    console.log();

    // Charger les produits actuels
    const { data: currentProducts, error } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity, priceWholesale, priceRetail");

    if (error) {
      console.error("❌ Erreur:", error.message);
      return;
    }

    console.log(`📊 Produits actuels: ${currentProducts?.length || 0}`);
    console.log();

    // Créer un index du backup par modelRef + color + ID
    const backupIndex = new Map();
    backupData.forEach(p => {
      // Index par ID si disponible
      if (p.id && p.id !== "GUESS") {
        backupIndex.set(`id:${String(p.id).toLowerCase().trim()}`, p);
      }
      // Index par modelRef + color
      const key = `${String(p.modelRef || "").toLowerCase().trim()}|${String(p.color || "").toLowerCase().trim()}`;
      if (!backupIndex.has(key)) {
        backupIndex.set(key, p);
      }
    });

    console.log(`📋 Index créé: ${backupIndex.size} entrées`);
    console.log();

    // Restaurer les valeurs
    let restored = 0;
    let notFound = 0;
    let errors = 0;
    const restoredProducts = [];

    for (const current of currentProducts || []) {
      // Chercher dans le backup
      let backupProduct = null;

      // D'abord par ID
      if (current.id && current.id !== "GUESS") {
        backupProduct = backupIndex.get(`id:${String(current.id).toLowerCase().trim()}`);
      }

      // Sinon par modelRef + color
      if (!backupProduct) {
        const key = `${String(current.modelRef || "").toLowerCase().trim()}|${String(current.color || "").toLowerCase().trim()}`;
        backupProduct = backupIndex.get(key);
      }

      if (backupProduct) {
        const backupStock = Number(backupProduct.stockQuantity) || 0;
        const backupPriceWholesale = Number(backupProduct.priceWholesale) || 0;
        const backupPriceRetail = Number(backupProduct.priceRetail) || 0;

        const currentStock = Number(current.stockQuantity) || 0;
        const currentPriceWholesale = Number(current.priceWholesale) || 0;

        // Vérifier si les valeurs sont différentes
        if (backupStock !== currentStock || backupPriceWholesale !== currentPriceWholesale) {
          const updates = {
            stockQuantity: backupStock,
            priceWholesale: backupPriceWholesale,
          };

          if (backupPriceRetail !== undefined && backupPriceRetail !== null) {
            updates.priceRetail = backupPriceRetail;
          }

          const { error: updateError } = await supabase
            .from("products")
            .update(updates)
            .eq("id", current.id);

          if (updateError) {
            console.error(`❌ Erreur pour ${current.modelRef} / ${current.color}:`, updateError.message);
            errors++;
          } else {
            restored++;
            restoredProducts.push({
              modelRef: current.modelRef,
              color: current.color,
              stock: `${currentStock} → ${backupStock}`,
              price: `₪${currentPriceWholesale.toLocaleString()} → ₪${backupPriceWholesale.toLocaleString()}`,
            });

            if (restored <= 10) {
              console.log(`✅ ${current.modelRef} / ${current.color}`);
              console.log(`   Stock: ${currentStock} → ${backupStock}`);
              console.log(`   Prix: ₪${currentPriceWholesale.toLocaleString()} → ₪${backupPriceWholesale.toLocaleString()}`);
            }
          }
        }
      } else {
        notFound++;
        if (notFound <= 5) {
          console.log(`⚠️  Produit non trouvé dans le backup: ${current.modelRef} / ${current.color} (ID: ${current.id})`);
        }
      }
    }

    console.log();
    console.log("=".repeat(60));
    console.log("📊 RÉSUMÉ DE LA RESTAURATION:");
    console.log("=".repeat(60));
    console.log();
    console.log(`✅ Produits restaurés: ${restored}`);
    console.log(`⚠️  Produits non trouvés dans le backup: ${notFound}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log();

    if (restored > 0) {
      console.log("💡 Les valeurs du backup ont été restaurées avec succès!");
      console.log("   Les images et autres informations ont été conservées.");
      console.log();
    }

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

restoreFromBackup().catch(console.error);


