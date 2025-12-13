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

async function analyzeProblem() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔍 ANALYSE DU PROBLÈME DE STOCK");
  console.log("=".repeat(60));
  console.log();

  try {
    // 1. Vérifier s'il y a un backup
    const backupDir = join(__dirname, "..", "data", "backups");
    const backups = fs.existsSync(backupDir) 
      ? fs.readdirSync(backupDir).filter(f => f.endsWith(".json")).sort().reverse()
      : [];

    if (backups.length > 0) {
      console.log("📦 BACKUPS DISPONIBLES:");
      backups.slice(0, 5).forEach((backup, idx) => {
        const backupPath = join(backupDir, backup);
        const stats = fs.statSync(backupPath);
        console.log(`   ${idx + 1}. ${backup}`);
        console.log(`      Date: ${stats.mtime.toLocaleString()}`);
        console.log(`      Taille: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log();
      });
    } else {
      console.log("⚠️  Aucun backup trouvé");
      console.log();
    }

    // 2. Analyser les produits actuels avec les valeurs les plus élevées
    console.log("📊 PRODUITS AVEC LES VALEURS LES PLUS ÉLEVÉES:");
    console.log();

    const { data: products, error } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity, priceWholesale, priceRetail")
      .order("stockQuantity", { ascending: false })
      .limit(20);

    if (error) {
      console.error("❌ Erreur:", error.message);
      return;
    }

    // Calculer la valeur pour chaque produit
    const productsWithValue = (products || []).map(p => {
      const stock = Number(p.stockQuantity) || 0;
      const price = Number(p.priceWholesale) || 0;
      const value = stock * price;
      return { ...p, value, stock, price };
    }).sort((a, b) => b.value - a.value);

    console.log("Top 20 produits par valeur totale (stock × prix):");
    console.log();
    productsWithValue.slice(0, 20).forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.modelRef} / ${p.color}`);
      console.log(`   Stock: ${p.stock} | Prix: ₪${p.price.toLocaleString()} | Valeur: ₪${p.value.toLocaleString()}`);
      console.log(`   ID: ${p.id}`);
      console.log();
    });

    // 3. Trouver les produits suspects
    console.log("=".repeat(60));
    console.log("⚠️  PRODUITS SUSPECTS:");
    console.log("=".repeat(60));
    console.log();

    const suspicious = productsWithValue.filter(p => 
      p.stock > 100 || 
      p.price > 5000 || 
      p.value > 50000 ||
      isNaN(p.stock) || 
      isNaN(p.price) ||
      !isFinite(p.stock) ||
      !isFinite(p.price)
    );

    if (suspicious.length > 0) {
      suspicious.forEach(p => {
        console.log(`⚠️  ${p.modelRef} / ${p.color}`);
        console.log(`   Stock: ${p.stock} | Prix: ₪${p.price.toLocaleString()} | Valeur: ₪${p.value.toLocaleString()}`);
        if (p.stock > 100) console.log(`   ⚠️  Stock très élevé (>100)`);
        if (p.price > 5000) console.log(`   ⚠️  Prix très élevé (>5000)`);
        if (p.value > 50000) console.log(`   ⚠️  Valeur totale très élevée (>50000)`);
        console.log();
      });
    } else {
      console.log("✅ Aucun produit suspect trouvé");
      console.log();
    }

    // 4. Statistiques globales
    const { data: allProducts } = await supabase
      .from("products")
      .select("stockQuantity, priceWholesale");

    const stats = {
      total: allProducts?.length || 0,
      totalValue: 0,
      totalStock: 0,
      avgPrice: 0,
      maxStock: 0,
      maxPrice: 0,
      productsWithHighStock: 0,
      productsWithHighPrice: 0,
    };

    allProducts?.forEach(p => {
      const stock = Number(p.stockQuantity) || 0;
      const price = Number(p.priceWholesale) || 0;
      
      if (isNaN(stock) || isNaN(price) || !isFinite(stock) || !isFinite(price)) {
        return;
      }

      stats.totalStock += stock;
      stats.totalValue += stock * price;
      stats.maxStock = Math.max(stats.maxStock, stock);
      stats.maxPrice = Math.max(stats.maxPrice, price);
      
      if (stock > 100) stats.productsWithHighStock++;
      if (price > 5000) stats.productsWithHighPrice++;
    });

    stats.avgPrice = stats.total > 0 ? stats.totalValue / stats.totalStock : 0;

    console.log("=".repeat(60));
    console.log("📈 STATISTIQUES GLOBALES:");
    console.log("=".repeat(60));
    console.log();
    console.log(`Total produits: ${stats.total}`);
    console.log(`Valeur totale: ₪${stats.totalValue.toLocaleString()}`);
    console.log(`Stock total: ${stats.totalStock.toLocaleString()} unités`);
    console.log(`Prix moyen: ₪${stats.avgPrice.toFixed(2)}`);
    console.log(`Stock maximum: ${stats.maxStock}`);
    console.log(`Prix maximum: ₪${stats.maxPrice.toLocaleString()}`);
    console.log(`Produits avec stock > 100: ${stats.productsWithHighStock}`);
    console.log(`Produits avec prix > 5000: ${stats.productsWithHighPrice}`);
    console.log();

    // 5. Comparer avec le backup si disponible
    if (backups.length > 0) {
      console.log("=".repeat(60));
      console.log("📦 COMPARAISON AVEC LE DERNIER BACKUP:");
      console.log("=".repeat(60));
      console.log();

      try {
        const latestBackup = backups[0];
        const backupPath = join(backupDir, latestBackup);
        const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
        
        const backupStats = {
          total: backupData.length || 0,
          totalValue: 0,
          totalStock: 0,
        };

        backupData.forEach((p) => {
          const stock = Number(p.stockQuantity) || 0;
          const price = Number(p.priceWholesale) || 0;
          if (!isNaN(stock) && !isNaN(price) && isFinite(stock) && isFinite(price)) {
            backupStats.totalStock += stock;
            backupStats.totalValue += stock * price;
          }
        });

        console.log(`Backup: ${latestBackup}`);
        console.log(`Valeur dans le backup: ₪${backupStats.totalValue.toLocaleString()}`);
        console.log(`Valeur actuelle: ₪${stats.totalValue.toLocaleString()}`);
        console.log(`Différence: ₪${(stats.totalValue - backupStats.totalValue).toLocaleString()}`);
        console.log();
      } catch (err) {
        console.log("⚠️  Impossible de lire le backup:", err.message);
        console.log();
      }
    }

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

analyzeProblem().catch(console.error);

