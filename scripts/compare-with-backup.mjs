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

async function compareWithBackup() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔍 COMPARAISON AVEC LE BACKUP");
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

    // Créer un index du backup par modelRef + color
    const backupIndex = new Map();
    backupData.forEach(p => {
      const key = `${String(p.modelRef || "").toLowerCase().trim()}|${String(p.color || "").toLowerCase().trim()}`;
      if (!backupIndex.has(key)) {
        backupIndex.set(key, []);
      }
      backupIndex.get(key).push(p);
    });

    // Créer un index des produits actuels par ID
    const currentById = new Map();
    currentProducts?.forEach(p => {
      if (p.id && p.id !== "GUESS") {
        currentById.set(String(p.id).toLowerCase().trim(), p);
      }
    });

    // Trouver les différences
    const differences = [];
    let totalDiffValue = 0;

    currentProducts?.forEach(current => {
      const key = `${String(current.modelRef || "").toLowerCase().trim()}|${String(current.color || "").toLowerCase().trim()}`;
      const backupMatches = backupIndex.get(key) || [];

      // Chercher le meilleur match dans le backup
      let bestMatch = null;
      
      // D'abord essayer par ID
      if (current.id && current.id !== "GUESS") {
        backupMatches.forEach(b => {
          if (String(b.id || "").toLowerCase().trim() === String(current.id).toLowerCase().trim()) {
            bestMatch = b;
          }
        });
      }

      // Sinon prendre le premier match par modelRef+color
      if (!bestMatch && backupMatches.length > 0) {
        bestMatch = backupMatches[0];
      }

      if (bestMatch) {
        const backupStock = Number(bestMatch.stockQuantity) || 0;
        const backupPrice = Number(bestMatch.priceWholesale) || 0;
        const currentStock = Number(current.stockQuantity) || 0;
        const currentPrice = Number(current.priceWholesale) || 0;

        const backupValue = backupStock * backupPrice;
        const currentValue = currentStock * currentPrice;
        const diffValue = currentValue - backupValue;

        if (backupStock !== currentStock || backupPrice !== currentPrice) {
          differences.push({
            modelRef: current.modelRef,
            color: current.color,
            id: current.id,
            backupStock,
            currentStock,
            backupPrice,
            currentPrice,
            backupValue,
            currentValue,
            diffValue,
            stockDiff: currentStock - backupStock,
            priceDiff: currentPrice - backupPrice,
          });

          totalDiffValue += diffValue;
        }
      } else {
        // Nouveau produit (pas dans le backup)
        const currentStock = Number(current.stockQuantity) || 0;
        const currentPrice = Number(current.priceWholesale) || 0;
        const currentValue = currentStock * currentPrice;
        
        differences.push({
          modelRef: current.modelRef,
          color: current.color,
          id: current.id,
          backupStock: 0,
          currentStock,
          backupPrice: 0,
          currentPrice,
          backupValue: 0,
          currentValue,
          diffValue: currentValue,
          stockDiff: currentStock,
          priceDiff: currentPrice,
          isNew: true,
        });

        totalDiffValue += currentValue;
      }
    });

    // Trier par différence de valeur (les plus grands changements en premier)
    differences.sort((a, b) => Math.abs(b.diffValue) - Math.abs(a.diffValue));

    console.log("=".repeat(60));
    console.log(`📊 ${differences.length} produits avec des différences`);
    console.log(`💰 Différence totale de valeur: ₪${totalDiffValue.toLocaleString()}`);
    console.log("=".repeat(60));
    console.log();

    // Afficher les 30 plus grandes différences
    console.log("🔴 TOP 30 DES PLUS GRANDS CHANGEMENTS:");
    console.log();
    
    differences.slice(0, 30).forEach((diff, idx) => {
      console.log(`${idx + 1}. ${diff.modelRef} / ${diff.color} ${diff.isNew ? "(NOUVEAU)" : ""}`);
      console.log(`   ID: ${diff.id}`);
      
      if (diff.stockDiff !== 0) {
        console.log(`   Stock: ${diff.backupStock} → ${diff.currentStock} (${diff.stockDiff > 0 ? "+" : ""}${diff.stockDiff})`);
      }
      
      if (diff.priceDiff !== 0) {
        console.log(`   Prix: ₪${diff.backupPrice.toLocaleString()} → ₪${diff.currentPrice.toLocaleString()} (${diff.priceDiff > 0 ? "+" : ""}₪${diff.priceDiff.toLocaleString()})`);
      }
      
      console.log(`   Valeur: ₪${diff.backupValue.toLocaleString()} → ₪${diff.currentValue.toLocaleString()} (${diff.diffValue > 0 ? "+" : ""}₪${diff.diffValue.toLocaleString()})`);
      console.log();
    });

    // Résumé par type de changement
    const stockOnlyChanges = differences.filter(d => d.stockDiff !== 0 && d.priceDiff === 0);
    const priceOnlyChanges = differences.filter(d => d.stockDiff === 0 && d.priceDiff !== 0);
    const bothChanges = differences.filter(d => d.stockDiff !== 0 && d.priceDiff !== 0);
    const newProducts = differences.filter(d => d.isNew);

    console.log("=".repeat(60));
    console.log("📈 RÉSUMÉ DES CHANGEMENTS:");
    console.log("=".repeat(60));
    console.log();
    console.log(`Stock uniquement: ${stockOnlyChanges.length} produits`);
    console.log(`Prix uniquement: ${priceOnlyChanges.length} produits`);
    console.log(`Stock + Prix: ${bothChanges.length} produits`);
    console.log(`Nouveaux produits: ${newProducts.length} produits`);
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

compareWithBackup().catch(console.error);



