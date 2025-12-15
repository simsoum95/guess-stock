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

async function checkStockValues() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("🔍 VÉRIFICATION DES VALEURS DE STOCK");
  console.log("=".repeat(60));
  console.log();

  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, modelRef, color, stockQuantity, priceWholesale, priceRetail")
      .order("stockQuantity", { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ Erreur:", error.message);
      return;
    }

    console.log(`📊 Analyse de ${products?.length || 0} produits (top 50 par stock)`);
    console.log();

    // Trouver les valeurs suspectes
    const suspicious = products?.filter(p => {
      const stock = Number(p.stockQuantity) || 0;
      const price = Number(p.priceWholesale) || 0;
      const value = stock * price;
      
      return stock > 1000 || price > 10000 || value > 100000 || 
             isNaN(stock) || isNaN(price) || !isFinite(stock) || !isFinite(price);
    }) || [];

    if (suspicious.length > 0) {
      console.log("⚠️  PRODUITS AVEC VALEURS SUSPECTES:");
      console.log();
      suspicious.forEach(p => {
        const stock = Number(p.stockQuantity) || 0;
        const price = Number(p.priceWholesale) || 0;
        const value = stock * price;
        console.log(`   ${p.modelRef} / ${p.color}`);
        console.log(`   Stock: ${stock} | Prix: ${price} | Valeur: ${value.toLocaleString()}`);
        console.log(`   ID: ${p.id}`);
        console.log();
      });
    }

    // Calculer la valeur totale
    const totalValue = products?.reduce((sum, p) => {
      const stock = Number(p.stockQuantity) || 0;
      const price = Number(p.priceWholesale) || 0;
      return sum + (stock * price);
    }, 0) || 0;

    console.log("=".repeat(60));
    console.log(`💰 Valeur totale du stock (top 50): ₪${totalValue.toLocaleString()}`);
    console.log("=".repeat(60));
    console.log();

    // Vérifier tous les produits
    const { data: allProducts } = await supabase
      .from("products")
      .select("stockQuantity, priceWholesale");

    const allTotalValue = allProducts?.reduce((sum, p) => {
      const stock = Number(p.stockQuantity) || 0;
      const price = Number(p.priceWholesale) || 0;
      if (isNaN(stock) || isNaN(price) || !isFinite(stock) || !isFinite(price)) {
        console.log(`⚠️  Valeur invalide: stock=${p.stockQuantity}, price=${p.priceWholesale}`);
        return sum;
      }
      return sum + (stock * price);
    }, 0) || 0;

    console.log(`💰 Valeur totale du stock (TOUS): ₪${allTotalValue.toLocaleString()}`);
    console.log();

    // Statistiques
    const maxStock = Math.max(...(allProducts?.map(p => Number(p.stockQuantity) || 0) || [0]));
    const maxPrice = Math.max(...(allProducts?.map(p => Number(p.priceWholesale) || 0) || [0]));
    
    console.log(`📈 Stock maximum: ${maxStock}`);
    console.log(`📈 Prix maximum: ₪${maxPrice.toLocaleString()}`);
    console.log();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
  }
}

checkStockValues().catch(console.error);



